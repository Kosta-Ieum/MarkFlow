import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { AppException } from "../../common/app.exception.js";
import type { User, UpdateProfileRequest } from "@markflow/shared";

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, dto: UpdateProfileRequest): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { nickname: dto.nickname },
      select: { id: true, email: true, name: true, nickname: true },
    });
    
    if (!user) throw AppException.notFound("사용자를 찾을 수 없습니다");
    return user;
  }
}
