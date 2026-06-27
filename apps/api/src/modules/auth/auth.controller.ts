// AuthController (@Controller("auth")) — POST /auth/signup·login, GET /auth/me
// TODO: 구현
//
// 회원가입 이메일 OTP (계약: apps/api/openapi.yaml, DTO: @markflow/shared) — BE 인계
// - POST /auth/email/send-code (security 없음/공개) — SendCodeRequest → SendCodeResponse
//     코드 생성(6자리) + 만료 저장 + 메일 발송. 응답은 { sent } 만(코드 노출 금지).
// - POST /auth/email/verify (security 없음/공개) — VerifyEmailRequest → VerifyEmailResponse
//     이메일+코드 검증. 불일치/만료 시 400(VALIDATION_ERROR). 성공 시 { verified: true }.
// TODO(BE): authService.sendEmailCode / verifyEmailCode 구현 + 컨트롤러 라우트 연결.
