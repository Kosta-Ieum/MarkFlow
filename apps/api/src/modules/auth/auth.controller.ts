import { Body, Controller, Get, Post } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import {
  SignupRequestSchema,
  LoginRequestSchema,
  type SignupRequest,
  type LoginRequest,
} from "@markflow/shared";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("signup")
  signup(@Body(new ZodValidationPipe(SignupRequestSchema)) dto: SignupRequest) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post("login")
  login(@Body(new ZodValidationPipe(LoginRequestSchema)) dto: LoginRequest) {
    return this.authService.login(dto);
  }

  // 전역 JwtAuthGuard가 기본 보호 — @Public() 없으니 가드 통과해야 진입
  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }
}
