import { Body, Controller, Patch } from "@nestjs/common";
import { UserService } from "./user.service.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { UpdateProfileRequestSchema } from "@markflow/shared";
import type { UpdateProfileRequest } from "@markflow/shared";

@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch("me")
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(UpdateProfileRequestSchema)) dto: UpdateProfileRequest,
  ) {
    return this.userService.updateProfile(user.sub, dto);
  }
}
