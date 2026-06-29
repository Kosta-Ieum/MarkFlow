import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AppException } from "../app.exception.js";

interface BearerRequest {
  headers: { authorization?: string };
  user: JwtPayload;
}

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
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
