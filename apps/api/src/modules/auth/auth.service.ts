import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AppException } from "../../common/app.exception.js";
import { env } from "../../config/env.js";
import { RefreshTokenStore } from "./refresh-token.store.js";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshStore: RefreshTokenStore,
  ) {}

  async signup(dto: SignupRequest): Promise<{ response: AuthResponse; tokenPair: TokenPair }> {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw AppException.conflict("이미 사용 중인 이메일입니다");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash },
      select: { id: true, email: true, name: true },
    });

    const tokenPair = await this.issueTokenPair(user.id, user.email);
    return { response: { accessToken: tokenPair.accessToken, user }, tokenPair };
  }

  async login(dto: LoginRequest): Promise<{ response: AuthResponse; tokenPair: TokenPair }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
    if (!user) throw AppException.invalidCredentials();

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) throw AppException.invalidCredentials();

    const { passwordHash: _, ...safeUser } = user;
    const tokenPair = await this.issueTokenPair(safeUser.id, safeUser.email);
    return { response: { accessToken: tokenPair.accessToken, user: safeUser }, tokenPair };
  }

  async refresh(oldRefreshToken: string): Promise<{ response: RefreshResponse; tokenPair: TokenPair }> {
    const stored = await this.refreshStore.verify(oldRefreshToken);
    if (!stored) throw AppException.unauthorized("유효하지 않거나 만료된 리프레시 토큰입니다");

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true },
    });
    if (!user) throw AppException.unauthorized("사용자를 찾을 수 없습니다");

    const expiresAt = this.calcRefreshExpiry();
    const newRefreshToken = this.genRefreshToken();
    await this.refreshStore.rotate(oldRefreshToken, user.id, newRefreshToken, expiresAt);

    const accessToken = this.signAccess(user);
    const tokenPair: TokenPair = { accessToken, refreshToken: newRefreshToken, refreshExpiresAt: expiresAt };
    return { response: { accessToken }, tokenPair };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshStore.delete(refreshToken);
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw AppException.notFound("사용자를 찾을 수 없습니다");
    return user;
  }

  private async issueTokenPair(userId: string, email: string): Promise<TokenPair> {
    const accessToken = this.signAccess({ id: userId, email });
    const refreshToken = this.genRefreshToken();
    const expiresAt = this.calcRefreshExpiry();
    await this.refreshStore.save(userId, refreshToken, expiresAt);
    return { accessToken, refreshToken, refreshExpiresAt: expiresAt };
  }

  private signAccess(user: { id: string; email: string }): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
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
