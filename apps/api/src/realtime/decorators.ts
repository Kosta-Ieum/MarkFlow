import { applyDecorators, UsePipes } from "@nestjs/common";
import { SubscribeMessage } from "@nestjs/websockets";
import { SocketPayloadSchemas } from "@markflow/shared";
import { WsZodValidationPipe } from "../common/pipes/ws-zod-validation.pipe.js";

/**
 * @SubscribeMessage 와 Zod 기반 @UsePipes 검증을 한 번에 적용하는 통합 데코레이터.
 * 
 * @param event SOCKET_EVENTS 의 키값 (예: "node:add")
 */
export function SubscribeWithValidation(event: keyof typeof SocketPayloadSchemas) {
  return applyDecorators(
    SubscribeMessage(event),
    UsePipes(new WsZodValidationPipe(SocketPayloadSchemas[event]))
  );
}
