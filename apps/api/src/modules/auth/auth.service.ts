import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AppException } from "../../common/app.exception.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import type {
  SignupRequest,
  LoginRequest,
  AuthResponse,
  User,
} from "@markflow/shared";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async signup(dto: SignupRequest): Promise<AuthResponse> {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw AppException.conflict("이미 사용 중인 이메일입니다");

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, passwordHash },
      select: { id: true, email: true, name: true },
    });

    return { accessToken: this.sign(user), user };
  }

  async login(dto: LoginRequest): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true, passwordHash: true },
    });
    if (!user) throw AppException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다");

    const match = await bcrypt.compare(dto.password, user.passwordHash);
    if (!match) throw AppException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다");

    const { passwordHash: _, ...safeUser } = user;
    return { accessToken: this.sign(safeUser), user: safeUser };
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw AppException.notFound("사용자를 찾을 수 없습니다");
    return user;
  }

  private sign(user: { id: string; email: string }): string {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwt.sign(payload);
  }
}
