---
name: api-contract-change
description: REST API · Socket.io 이벤트 · 공용 DTO 변경 절차. apps/api/openapi.yaml, packages/shared/src, Docs/09-API-Spec.md 변경 시 사용.
---

# API Contract Change

계약 정본: REST = `apps/api/openapi.yaml`, Socket/DTO = `packages/shared/src/`(SOCKET_EVENTS + zod schema). `Docs/09-API-Spec.md`는 설명 문서(정본 아님).

1. **정본을 먼저 고친다.**
   - REST 변경이면 `apps/api/openapi.yaml`.
   - Socket 이벤트/공용 DTO 변경이면 `packages/shared/src/schemas.ts`(DTO) 또는 `packages/shared/src/socket.ts`(이벤트명·payload).
2. **양쪽 사용처 동시 갱신**: `apps/api`(컨트롤러/게이트웨이·service)와 `apps/web`(`lib/api`·CollabAPI). 같은 mutation을 REST·Socket 양쪽에 중복 구현하지 말고 같은 service를 호출한다.
3. **권한 가드**: REST + Socket **양쪽** 모두 service 진입부에서 `assertPermission`. 프론트 비활성화는 UX용일 뿐 가드 아님.
4. `Docs/09-API-Spec.md`를 정본을 설명하도록 동기화. 필요 시 `Docs/08-ERD.md`도.
5. **breaking change 여부**를 PR에 명시(필드 제거·이름변경·필수화).
6. 검증: `pnpm openapi:lint` · `pnpm -r typecheck` · `./scripts/check`.
7. `reviewer` 에이전트로 검토. 확인 항목:
   - OpenAPI ↔ 실제 구현 라우트 일치
   - shared zod schema ↔ BE/FE 사용처 일치
   - REST + Socket 권한 가드 누락 없음
   - 기존 클라이언트 호환성 영향
