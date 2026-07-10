import { HttpException, HttpStatus } from "@nestjs/common";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "INTERNAL";

export class AppException extends HttpException {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, status: HttpStatus, message: string) {
    super(message, status);
    this.code = code;
  }

  static badRequest(message: string) {
    return new AppException("VALIDATION_ERROR", HttpStatus.BAD_REQUEST, message);
  }

  static unauthorized(message = "인증이 필요합니다") {
    return new AppException("UNAUTHORIZED", HttpStatus.UNAUTHORIZED, message);
  }

  static invalidCredentials(message = "이메일 또는 비밀번호가 올바르지 않습니다") {
    return new AppException("INVALID_CREDENTIALS", HttpStatus.BAD_REQUEST, message);
  }

  static forbidden(message = "권한이 없습니다") {
    return new AppException("FORBIDDEN", HttpStatus.FORBIDDEN, message);
  }

  static notFound(message: string) {
    return new AppException("NOT_FOUND", HttpStatus.NOT_FOUND, message);
  }

  static conflict(message: string) {
    return new AppException("CONFLICT", HttpStatus.CONFLICT, message);
  }

  static unprocessable(message: string) {
    return new AppException("UNPROCESSABLE", HttpStatus.UNPROCESSABLE_ENTITY, message);
  }
}
