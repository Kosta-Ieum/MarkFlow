import { z } from "zod";
import { ChatMessageCreateRequestSchema, MessagesResponseSchema } from "@markflow/shared";

// Controller 내부에서 유효성 검사 파이프(ZodValidationPipe)용으로 노출
export { ChatMessageCreateRequestSchema, MessagesResponseSchema };

export type ChatMessageCreateRequest = z.infer<typeof ChatMessageCreateRequestSchema>;
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;
