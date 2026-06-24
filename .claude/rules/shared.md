---
paths:
  - "packages/shared/**"
---

# Shared contract invariants (packages/shared)

- 여기는 **BE↔FE 계약**(DTO · `SOCKET_EVENTS` · `Role`/`NodeType` 등). 변경은 breaking change가 될 수 있다.
- 변경 시: `apps/api`·`apps/web` 양쪽 사용처 + `Docs/09-API-Spec.md`(필요 시 `08-ERD.md`) 동시 갱신.
- 런타임 의존성 최소(타입·상수 위주). 무거운 로직 금지.
- 필드 제거/이름변경은 양쪽 사용처를 먼저 확인한 뒤.
