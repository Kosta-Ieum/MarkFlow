import { Catch, ArgumentsHost } from "@nestjs/common";
import { BaseWsExceptionFilter, WsException } from "@nestjs/websockets";
import { AppException } from "../app.exception.js";

/**
 * 전역 소켓 예외 필터
 * WsException(검증 실패 등) 및 AppException(권한, 비즈니스 에러)를 낚아채서
 * 클라이언트의 ack 콜백으로 { ok: false, error: { code, message } } 형태를 반환합니다.
 */
@Catch()
export class WsExceptionAckFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const callback = host.getArgByIndex(2); // socket.io ack 콜백
    
    if (typeof callback === "function") {
      let errorResponse = { code: "INTERNAL", message: "서버 내부 오류가 발생했습니다" };
      
      if (exception instanceof WsException) {
        const err = exception.getError();
        errorResponse = typeof err === "object" && err !== null && "code" in err
          ? (err as any)
          : { code: "VALIDATION_ERROR", message: typeof err === "string" ? err : "Validation failed" };
      } else if (exception instanceof AppException) {
        errorResponse = { code: exception.code, message: exception.message };
      } else if (exception instanceof Error) {
        errorResponse = { code: "INTERNAL", message: exception.message };
      }

      callback({ ok: false, error: errorResponse });
    } else {
      // ack 콜백이 없으면 NestJS 기본 동작(이벤트 emit) 수행
      super.catch(exception, host);
    }
  }
}
