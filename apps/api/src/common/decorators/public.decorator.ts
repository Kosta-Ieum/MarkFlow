import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

// 전역 JwtAuthGuard를 우회할 라우트에 붙인다 (예: signup, login)
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
