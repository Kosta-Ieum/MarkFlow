import { Module } from "@nestjs/common";

// 루트 모듈 — 도메인 모듈(auth·projects·nodes·edges·members·chat·activity)·PrismaModule·realtime gateway는
// 구현 시 imports에 등록. (Socket.io는 @nestjs/platform-socket.io 기본 IoAdapter)
@Module({})
export class AppModule {}
