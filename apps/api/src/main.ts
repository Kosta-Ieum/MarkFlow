import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { env } from "./config/env.js";
import { AppModule } from "./app.module.js";
import { AppExceptionFilter } from "./common/filters/app-exception.filter.js";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors();

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AppExceptionFilter());

  await app.listen(env.PORT);
}

void bootstrap();
