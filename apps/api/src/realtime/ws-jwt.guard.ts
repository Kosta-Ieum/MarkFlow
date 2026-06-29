import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import type { JwtPayload } from "../common/guards/jwt-auth.guard.js";

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const client = ctx.switchToWs().getClient<Socket>();
    const token =
      (client.handshake.auth as { token?: string }).token ??
      (client.handshake.headers.authorization as string | undefined)?.replace("Bearer ", "");

    if (!token) {
      client.disconnect();
      return false;
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      client.data.user = payload;
      return true;
    } catch {
      client.disconnect();
      return false;
    }
  }
}
