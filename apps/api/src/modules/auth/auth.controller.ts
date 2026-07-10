import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import type { JwtPayload } from "../../common/guards/jwt-auth.guard.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { AppException } from "../../common/app.exception.js";
import { env } from "../../config/env.js";
import {
 
  LoginRequestSchema,
  SignupRequestSchema,
  SendCodeRequestSchema,
  VerifyEmailRequestSchema,
} from "@markflow/shared";
import type {
  
  LoginRequest,
  SignupRequest,
  SendCodeRequest,
  VerifyEmailRequest,
} from "@markflow/shared";
import type { TokenPair } from "./auth.service.js";

const REFRESH_COOKIE = "refresh_token";

function setRefreshCookie(res: Response, pair: TokenPair): void {
  res.cookie(REFRESH_COOKIE, pair.refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    expires: pair.refreshExpiresAt,
    path: "/",
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("signup")
  async signup(
    @Body(new ZodValidationPipe(SignupRequestSchema)) dto: SignupRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { response, tokenPair } = await this.authService.signup(dto);
    setRefreshCookie(res, tokenPair);
    return response;
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) dto: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { response, tokenPair } = await this.authService.login(dto);
    setRefreshCookie(res, tokenPair);
    return response;
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldToken = (req.cookies as Record<string, string>)[REFRESH_COOKIE];
    if (!oldToken) throw AppException.unauthorized("리프레시 토큰이 없습니다");
    const { response, tokenPair } = await this.authService.refresh(oldToken);
    setRefreshCookie(res, tokenPair);
    return response;
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string>)[REFRESH_COOKIE];
    if (token) await this.authService.logout(token);
    clearRefreshCookie(res);
    return { ok: true };
  }

  @Public()
  @Post("email/send-code")
  @HttpCode(200)
  async sendEmailCode(@Body(new ZodValidationPipe(SendCodeRequestSchema)) dto: SendCodeRequest) {
    const sent = await this.authService.sendEmailCode(dto.email);
    return { sent };
  }

  @Public()
  @Post("email/verify")
  @HttpCode(200)
  async verifyEmailCode(@Body(new ZodValidationPipe(VerifyEmailRequestSchema)) dto: VerifyEmailRequest) {
    const verified = await this.authService.verifyEmailCode(dto.email, dto.code);
    return { verified };
  }

  // 전역 JwtAuthGuard가 기본 보호 — @Public() 없으니 가드 통과해야 진입
  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }
}
