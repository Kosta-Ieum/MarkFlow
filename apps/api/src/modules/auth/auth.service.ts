import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import * as nodemailer from "nodemailer";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AppException } from "../../common/app.exception.js";
import { env } from "../../config/env.js";
import { RefreshTokenStore } from "./refresh-token.store.js";
import { ProjectEventsService } from "../../common/events/project-events.service.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import type {
  SignupRequest,
  LoginRequest,
  AuthResponse,
  RefreshResponse,
  User,
} from "@markflow/shared";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshStore: RefreshTokenStore,
    private readonly events: ProjectEventsService,
  ) {
    if (env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    }
  }

  async signup(dto: SignupRequest): Promise<{ response: AuthResponse; tokenPair: TokenPair }> {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw AppException.conflict("이미 사용 중인 이메일입니다");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash, nickname: dto.nickname },
      select: { id: true, email: true, name: true, nickname: true },
    });

    const tokenPair = await this.issueTokenPair(user.id, user.email);
    return { response: { accessToken: tokenPair.accessToken, user }, tokenPair };
  }

  async login(dto: LoginRequest): Promise<{ response: AuthResponse; tokenPair: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true, nickname: true, passwordHash: true },
    });
    if (!user) throw AppException.invalidCredentials();

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) throw AppException.invalidCredentials();

    const { passwordHash: _, ...safeUser } = user;
    
    // 중복 로그인 방지: 새 기기에서 로그인 시 기존 기기의 모든 세션(토큰) 만료
    await this.refreshStore.deleteByUser(safeUser.id);
    this.events.emit({ type: "USER_LOGGED_OUT", payload: { userId: safeUser.id } });

    const tokenPair = await this.issueTokenPair(safeUser.id, safeUser.email);
    return { response: { accessToken: tokenPair.accessToken, user: safeUser }, tokenPair };
  }

  async refresh(oldRefreshToken: string): Promise<{ response: RefreshResponse; tokenPair: TokenPair }> {
    const rawToken = await this.prisma.refreshToken.findUnique({ where: { token: oldRefreshToken } });
    
    // DB에 아예 없으면 -> 중복 로그인(다른 기기 접속)으로 인해 삭제된 것
    if (!rawToken) throw AppException.conflict("다른 기기에서 로그인되어 세션이 만료되었습니다.");
    
    // DB에는 있지만 기한이 지났으면 -> 자연 만료
    if (rawToken.expiresAt <= new Date()) throw AppException.unauthorized("리프레시 토큰이 만료되었습니다.");

    const stored = rawToken;

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true },
    });
    if (!user) throw AppException.unauthorized("사용자를 찾을 수 없습니다");

    const expiresAt = this.calcRefreshExpiry();
    const newRefreshToken = this.genRefreshToken();
    const sessionId = await this.refreshStore.rotate(oldRefreshToken, user.id, newRefreshToken, expiresAt);

    const accessToken = this.signAccess({ id: user.id, email: user.email }, sessionId);
    const tokenPair: TokenPair = { accessToken, refreshToken: newRefreshToken, refreshExpiresAt: expiresAt };
    return { response: { accessToken }, tokenPair };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshStore.delete(refreshToken);
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, nickname: true },
    });
    if (!user) throw AppException.notFound("사용자를 찾을 수 없습니다");
    return user;
  }

  async sendEmailCode(email: string): Promise<boolean> {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) {
      throw AppException.conflict("이미 가입된 이메일입니다.");
    }

    const existingOTP = await this.prisma.emailVerification.findFirst({
      where: { email },
    });
    if (existingOTP && existingOTP.expiresAt > new Date()) {
      throw AppException.conflict("이미 유효한 인증 코드가 발송되었습니다. 3분 뒤에 다시 시도해주세요.");
    }

    const code = randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

    await this.prisma.emailVerification.deleteMany({ where: { email } });
    await this.prisma.emailVerification.create({
      data: { email, code, expiresAt },
    });

    if (!this.transporter || !env.SMTP_USER) {
      console.info(`[Mock Email] To: ${email}, Code: ${code}`);
      return true;
    }

    try {
      // SMTP 발송을 비동기(백그라운드)로 처리하여 API 응답(클라이언트)이 지연되지 않도록 합니다.
      this.transporter
        .sendMail({
          from: `"MarkFlow" <${env.SMTP_USER}>`,
          to: email,
          subject: "[MarkFlow] 이메일 인증 코드",
          html: `<p>안녕하세요!</p><p>MarkFlow 가입 인증 코드는 <strong>${code}</strong> 입니다.</p><p>3분 이내에 입력해주세요.</p>`,
        })
        .catch((err) => {
          console.error("[Email Async Error]", err);
        });
      return true;
    } catch (err) {
      console.error("[Email Error]", err);
      throw AppException.internal("이메일 발송 준비에 실패했습니다");
    }
  }

  async verifyEmailCode(email: string, code: string): Promise<boolean> {
    const record = await this.prisma.emailVerification.findFirst({
      where: { email, code },
    });

    if (!record) {
      throw AppException.badRequest("인증 코드가 올바르지 않습니다.");
    }

    if (record.expiresAt < new Date()) {
      await this.prisma.emailVerification.delete({ where: { id: record.id } });
      throw AppException.badRequest("인증 코드가 만료되었습니다.");
    }

    await this.prisma.emailVerification.delete({ where: { id: record.id } });
    return true;
  }
  private async issueTokenPair(userId: string, email: string): Promise<TokenPair> {
    const refreshToken = this.genRefreshToken();
    const expiresAt = this.calcRefreshExpiry();
    const sessionId = await this.refreshStore.save(userId, refreshToken, expiresAt);
    const accessToken = this.signAccess({ id: userId, email }, sessionId);
    return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
  }

  private signAccess(user: { id: string; email: string }, sessionId?: string): string {
    const payload: JwtPayload = { sub: user.id, email: user.email, ...(sessionId && { sessionId }) };
    return this.jwt.sign(payload);
  }

  private genRefreshToken(): string {
    return randomBytes(64).toString("hex");
  }

  private calcRefreshExpiry(): Date {
    const raw = env.REFRESH_JWT_EXPIRES_IN; // e.g. "30d", "7d"
    const match = /^(\d+)([dhms])$/.exec(raw);
    const unit = match?.[2] ?? "d";
    const amount = match ? parseInt(match[1], 10) : 30;
    const ms: Record<string, number> = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
    return new Date(Date.now() + amount * (ms[unit] ?? ms["d"]));
  }
}
