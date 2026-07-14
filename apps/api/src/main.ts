import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { AppModule } from "./app.module.js";
import { AppExceptionFilter } from "./common/filters/app-exception.filter.js";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  
  // CORS_ORIGIN 설정 시 해당 origin만 허용, 미설정 시 전체 허용(요청 origin 반영).
  app.enableCors({
    origin: env.CORS_ORIGIN
      ? env.CORS_ORIGIN.split(",").map((o) => o.trim())
      : true,
    credentials: true,
  });
  app.use(cookieParser());

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AppExceptionFilter());

  await app.listen(env.PORT);
}

void bootstrap();
