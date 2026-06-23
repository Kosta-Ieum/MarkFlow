---
paths:
  - "packages/shared/**"
---

# Shared contract invariants (packages/shared)

- 여기는 **Socket/DTO 계약 정본**: `schemas.ts`(DTO zod) · `socket.ts`(`SOCKET_EVENTS` + payload zod) · `types.ts`(z.infer). 변경은 breaking change가 될 수 있다.
- **REST 계약 정본은 별도** — `apps/api/openapi.yaml`. DTO 형태는 openapi와 정합해야 한다.
- 타입은 zod schema에서 파생(`z.infer`). 형태를 바꾸려면 `schemas.ts`/`socket.ts`를 먼저 고친다(`types.ts` 단독 수정 금지).
- 변경 시: `apps/api`·`apps/web` 양쪽 사용처 + `Docs/09-API-Spec.md`(필요 시 `08-ERD.md`) 동시 갱신. 절차 → `api-contract-change` 스킬.
- 런타임 의존성은 `zod`만(검증 목적). 그 외 무거운 로직 금지.
- 필드 제거/이름변경은 양쪽 사용처를 먼저 확인한 뒤.
