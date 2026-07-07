import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { AppModule } from "./app.module.js";
import { AppExceptionFilter } from "./common/filters/app-exception.filter.js";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  app.use(cookieParser());

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AppExceptionFilter());

  await app.listen(env.PORT);
}

void bootstrap();
