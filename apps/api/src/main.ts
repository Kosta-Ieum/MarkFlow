import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { SwaggerModule } from "@nestjs/swagger";
import * as yaml from "js-yaml";
import * as fs from "fs";
import { join } from "path";
import { env } from "./config/env.js";
import { AppModule } from "./app.module.js";
import { AppExceptionFilter } from "./common/filters/app-exception.filter.js";
import { ZodValidationPipe } from "./common/pipes/zod-validation.pipe.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Swagger UI 설정
  const possiblePaths = [
    join(process.cwd(), "openapi.yaml"), // Local (apps/api) 또는 Docker (/app/apps/api)
    join(process.cwd(), "apps/api/openapi.yaml"), // 혹시 모를 루트 실행 대비
  ];
  let openapiPath = "";
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      openapiPath = p;
      break;
    }
  }
  if (openapiPath) {
    const file = fs.readFileSync(openapiPath, "utf8");
    const document = yaml.load(file) as any;
    SwaggerModule.setup("api/docs", app, document);
  } else {
    console.warn("⚠️ openapi.yaml 파일을 찾을 수 없어 Swagger UI를 구동하지 못했습니다.");
  }

  
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
