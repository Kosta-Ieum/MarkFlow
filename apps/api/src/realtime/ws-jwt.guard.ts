import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Socket } from "socket.io";
import type { JwtPayload } from "../common/guards/jwt-auth.guard.js";

// WS용 JWT 검증. 두 가지 역할:
// 1) verifyHandshake — 연결(handshake) 시 1회 신원 검증. Gateway.afterInit의 server.use() 미들웨어에서 호출.
//    성공 시 socket.data.userId를 채운다. 실패 시 throw(handshake 자체를 거부).
// 2) canActivate — @SubscribeMessage 핸들러에 방어적으로 붙이는 CanActivate. 재검증이 아니라
//    handshake에서 이미 채워진 socket.data.userId 존재 여부만 확인한다.
@Injectable()
export class WsJwtGuard implements CanActivate {
  // esbuild/vitest 런타임에선 emitDecoratorMetadata가 신뢰할 수 없어 암시적 타입 기반 DI가
  // 조용히 실패할 수 있다(app.module.ts의 JwtAuthGuard useFactory와 동일 이유) — @Inject로 명시.
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  async verifyHandshake(socket: Socket): Promise<string> {
    const token = (socket.handshake.auth as { token?: string })?.token;
    if (!token) throw new Error("UNAUTHORIZED");

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new Error("UNAUTHORIZED");
    }

    socket.data.userId = payload.sub;
    socket.data.email = payload.email;
    return payload.sub;
  }

  canActivate(ctx: ExecutionContext): boolean {
    const client = ctx.switchToWs().getClient<Socket>();
    return typeof client.data?.userId === "string";
  }
}
