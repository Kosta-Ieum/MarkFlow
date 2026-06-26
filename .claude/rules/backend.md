---
paths:
  - "apps/api/**"
---

# Backend invariants (apps/api)

상세 → `Docs/06-Backend-Architecture.md`

- **레이어드**: Controller(`@Controller`)/Gateway(`@WebSocketGateway`) → Service(`@Injectable` provider) → Prisma. 컨트롤러·게이트웨이는 전송만(입력 파싱·서비스 호출·응답). Prisma 직접 호출·권한 if문·비즈니스 로직 금지.
- **서비스 seam**: REST 컨트롤러와 Socket 게이트웨이는 **같은 service(`@Injectable` provider)**를 주입받아 호출한다. 같은 mutation을 양쪽에 중복 구현 금지(ActivityLog 누락·정합성 붕괴 방지).
- **권한**: 모든 변경 service 진입부에서 `assertPermission(projectId, userId, minRole)`. 뷰어 변경은 403/거부. REST·Socket 양쪽 동일 함수.
- **트랜잭션**: 변경 + ActivityLog 기록은 한 `$transaction`. 예) 노드 휴지통 = soft-delete + 연결 엣지 물리삭제 + 로그.
- **인증**: `JwtAuthGuard`(REST) · `WsJwtGuard`(WS)로 JWT 검증.
- **에러**: `AppException(code, status)` throw → `ExceptionFilter`가 표준 포맷(`Docs/09-API-Spec.md §0.3`). Socket은 `ack({ ok:false, error })`.
- **검증**: `shared/dto`(zod) 재사용. **Repository 레이어 추가 금지** — Prisma가 데이터 접근 계층.
