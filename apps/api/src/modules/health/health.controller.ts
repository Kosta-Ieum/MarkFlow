import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator.js";

// 배포 플랫폼(Railway) 헬스체크 전용 — 인증 없이 200. 비즈니스 로직 없음(service 불필요).
@Controller("health")
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: "ok" };
  }
}
