import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard, type JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
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

  @Post("signup")
  signup(@Body(new ZodValidationPipe(SignupRequestSchema)) dto: SignupRequest) {
    return this.authService.signup(dto);
  }

  @Post("login")
  login(@Body(new ZodValidationPipe(LoginRequestSchema)) dto: LoginRequest) {
    return this.authService.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }
}
