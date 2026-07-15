import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

/**
 * Refresh token 저장소 추상화.
 * 내부는 Prisma(DB) — 나중에 Redis로 교체할 때 이 파일만 수정한다.
 */
@Injectable()
export class RefreshTokenStore {
  constructor(private readonly prisma: PrismaService) {}

  async save(userId: string, token: string, expiresAt: Date): Promise<string> {
    const record = await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
    return record.id;
  }

  /** 유효(미만료) 토큰 조회. 없으면 null. */
  async verify(token: string) {
    return this.prisma.refreshToken.findFirst({
      where: { token, expiresAt: { gt: new Date() } },
    });
  }

  /** 기존 토큰 유지 + 만료 기한만 연장 (로테이션 미사용/Race Condition 방지) */
  async extend(token: string, expiresAt: Date): Promise<string> {
    const records = await this.prisma.refreshToken.findMany({ where: { token } });
    if (records.length === 0) throw new Error("Token not found");
    const record = await this.prisma.refreshToken.update({
      where: { id: records[0].id },
      data: { expiresAt },
    });
    return record.id;
  }

  async delete(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
