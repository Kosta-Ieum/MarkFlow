import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { AppException } from "../app.exception.js";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator.js";

interface BearerRequest {
  headers: { authorization?: string };
  user: JwtPayload;
}

export interface JwtPayload {
  sub: string;
  email: string;
  sessionId?: string;
}

// app.module.ts에서 APP_GUARD로 전역 등록됨 — 기본적으로 모든 라우트를 보호.
// @Public() 붙은 라우트(signup/login)만 예외로 통과시킨다.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly prisma: import("../../prisma/prisma.service.js").PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<BearerRequest>();
    const token = this.extractToken(req);
    if (!token) throw AppException.unauthorized();

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);

      // Stateful 세션 검증: 다른 기기 접속(중복 로그인)으로 토큰이 지워졌는지 확인
      if (payload.sessionId) {
        const sessionExists = await this.prisma.refreshToken.findUnique({
          where: { id: payload.sessionId },
        });
        if (!sessionExists) {
          throw AppException.conflict("다른 기기에서 로그인되어 세션이 만료되었습니다");
        }
      }

      req.user = payload;
    } catch (e: any) {
      if (e instanceof AppException) throw e;
      throw AppException.unauthorized("유효하지 않거나 만료된 토큰입니다");
    }

    return true;
  }

  private extractToken(req: BearerRequest): string | undefined {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    return undefined;
  }
}
