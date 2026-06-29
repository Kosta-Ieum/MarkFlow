import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { AppException, type ErrorCode } from "../app.exception.js";

interface HttpRequest { method: string; url: string }
interface HttpResponse { status(code: number): this; json(body: unknown): this }

const HTTP_STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE",
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<HttpResponse>();
    const req = ctx.getRequest<HttpRequest>();

    let status: number;
    let code: ErrorCode;
    let message: string;

    if (exception instanceof AppException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = HTTP_STATUS_TO_CODE[status] ?? "INTERNAL";
      const body = exception.getResponse();
      message =
        typeof body === "string"
          ? body
          : (body as { message?: string | string[] }).message
              instanceof Array
          ? ((body as { message: string[] }).message).join(", ")
          : ((body as { message?: string }).message ?? exception.message);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = "INTERNAL";
      message = "서버 내부 오류가 발생했습니다";
      this.logger.error(exception);
    }

    res.status(status).json({
      error: { code, message },
    });

    this.logger.warn(`${req.method} ${req.url} → ${status} [${code}] ${message}`);
  }
}
