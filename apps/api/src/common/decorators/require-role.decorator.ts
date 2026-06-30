import { SetMetadata } from "@nestjs/common";
import type { Role } from "@prisma/client";

export const REQUIRED_ROLE_KEY = "requiredRole";

// ProjectRoleGuard가 읽는 메타데이터. assertPermission(minRole)에 그대로 전달됨.
export const RequireRole = (role: Role) => SetMetadata(REQUIRED_ROLE_KEY, role);
