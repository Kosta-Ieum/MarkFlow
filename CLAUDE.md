@AGENTS.md

# MarkFlow — Repository Contract

마크다운 노드 기반 실시간 협업 캔버스. 3인 / 4주. pnpm 모노레포.

## ⚠️ 필수 준수 — 이탈 금지 (모든 세션·작업에 적용)
- 이 문서 · `AGENTS.md` · `.claude/rules/`의 규칙을 **반드시 따른다.** 이 규칙은 선택이 아니다.
- 규칙·가이드라인을 **벗어나야 하는 변경이 필요하면, 임의로 진행하지 말고 멈춰서 사람에게 먼저 확인**한다.
- 정본(`Docs/` · `apps/api/openapi.yaml` · `packages/shared/src/`)을 **추측으로 대체하지 않는다** — 불확실하면 해당 파일을 먼저 읽는다.
- **작업 시작 전**: 건드릴 경로의 `.claude/rules/`(backend·frontend·realtime·data·shared)와 관련 `Docs/`를 먼저 확인한다.
- 선언한 파일 범위만 수정한다. 다른 도메인·공개 계약(`packages/shared`·openapi)을 바꿔야 하면 멈추고 보고한다.

## Canonical sources (이 파일에 복제 금지 — 아래를 정본으로 참조)
- 설계 문서: `Docs/` (`00-Getting-Started` ~ `11-Conventions`)
- 데이터 모델: `Docs/08-ERD.md` ↔ `apps/api/prisma/schema.prisma`
- REST API 정본(기계 판독): `apps/api/openapi.yaml`
- Socket 이벤트·공용 DTO 정본: `packages/shared/src/` (`SOCKET_EVENTS` + zod schema)
- API 설명 문서(정본 아님): `Docs/09-API-Spec.md`
- 아키텍처: `Docs/06-Backend-Architecture.md` · `Docs/07-Frontend-Architecture.md`
- 역할/경계: `Docs/10-Team-Roles.md` · 컨벤션(코딩·Git): `Docs/11-Conventions.md`
- 일정·이슈: **Linear**(워크스페이스 `kostateam2`, 문서 없음)
- 경로별 상세 불변식: `.claude/rules/`

## 구조
- `apps/api` — 백엔드 (Express + Socket.io + Prisma)
- `apps/web` — 프론트 (React + Vite + React Flow + Zustand + Tailwind)
- `packages/shared` — BE↔FE 공용 타입/DTO/소켓 이벤트 (계약)

## Standard commands
- 환경 셋업: `./scripts/bootstrap`
- 검증: `./scripts/check`
- 테스트: `./scripts/test`
- 개발 서버: `pnpm dev` (api+web 동시)
- 브랜치: `git lb <IEUM-id>` (Linear 이슈로 자동 생성)

## Non-negotiable rules
- 생성물 직접 편집 금지: `node_modules/`, `**/dist/`, `apps/api/prisma/migrations/`, Prisma client.
- push · merge · deploy · 프로덕션 데이터 변경 금지.
- 스키마 변경은 Prisma 마이그레이션 + 롤백 설명 + `Docs/08-ERD.md` 동시 갱신.
- REST 계약 변경은 `apps/api/openapi.yaml`을 먼저 수정(정본). `packages/shared` DTO/이벤트 변경은 `packages/shared/src/`(zod)를 먼저 수정. 둘 다 BE·FE 양쪽 사용처 + `Docs/09-API-Spec.md` 동시 갱신. (절차 → `api-contract-change` 스킬)
- 권한은 서버가 최종 가드 — REST + Socket **양쪽**. 프론트 비활성화는 UX용.
- 새 의존성은 기존으로 불가능한 이유를 설명한 뒤 추가.

## 핵심 불변식 (상세 → `.claude/rules/`)
- 캔버스 저장 = Node/Edge **정규화** (JSONB 아님). 히스토리 = **ActivityLog 폴리모픽**.
- 실시간 = **Socket.io 정본**, `useCollaboration`(CollabAPI) 추상화 뒤. 룸 = `project:<id>`.
- 백엔드: 비즈니스 로직은 **service에만**(전송 ≠ 로직). 프론트: **Zustand 단일 진실원**.

## Completion contract (완료 보고 전)
1. `./scripts/check` 실행.
2. 변경 파일 목록.
3. 실행한 테스트와 결과.
4. 호환성 · 마이그레이션 · 보안 위험.
5. 검증하지 못한 것 명시.
