import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";
import { AppException } from "../app.exception.js";

interface ZodDtoClass {
  schema: ZodSchema;
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema = this.schema
      ?? (metadata.metatype as (ZodDtoClass & { new(...args: unknown[]): unknown }) | undefined)?.schema;

    if (!schema || typeof schema.safeParse !== "function") {
      return value;
    }

    const result = schema.safeParse(value);
    if (!result.success) {
      const messages = result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ");
      throw AppException.badRequest(messages);
    }
    return result.data;
  }
}
