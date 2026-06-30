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
}

// app.module.ts에서 APP_GUARD로 전역 등록됨 — 기본적으로 모든 라우트를 보호.
// @Public() 붙은 라우트(signup/login)만 예외로 통과시킨다.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
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
      req.user = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
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
