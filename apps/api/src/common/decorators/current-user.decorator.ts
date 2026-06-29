import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { JwtPayload } from "../guards/jwt-auth.guard.js";

interface AuthRequest { user: JwtPayload }

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtPayload => {
    return ctx.switchToHttp().getRequest<AuthRequest>().user;
  },
);
