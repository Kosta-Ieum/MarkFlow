import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

/**
 * Refresh token 저장소 추상화.
 * 내부는 Prisma(DB) — 나중에 Redis로 교체할 때 이 파일만 수정한다.
 */
@Injectable()
export class RefreshTokenStore {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
  }

  /** 유효(미만료) 토큰 조회. 없으면 null. */
  async verify(token: string) {
    return this.prisma.refreshToken.findFirst({
      where: { token, expiresAt: { gt: new Date() } },
    });
  }

  /** 옛 토큰 무효화 + 새 토큰 저장 (트랜잭션) */
  async rotate(
    oldToken: string,
    userId: string,
    newToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({ where: { token: oldToken } }),
      this.prisma.refreshToken.create({ data: { userId, token: newToken, expiresAt } }),
    ]);
  }

  async delete(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
