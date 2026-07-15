import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";
import { WsException } from "@nestjs/websockets";

/**
 * 소켓 페이로드 검증용 Zod 파이프
 * 실패 시 WsException을 던지며, 이는 WsExceptionAckFilter에서 처리되어 ack로 응답됩니다.
 */
@Injectable()
export class WsZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    // @ConnectedSocket() 등 body가 아닌 인자는 검증을 건너뛴다.
    if (metadata.type !== "body") {
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      const messages = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      throw new WsException({ code: "VALIDATION_ERROR", message: messages });
    }
    return result.data;
  }
}
