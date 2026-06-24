@AGENTS.md

# MarkFlow — Repository Contract

마크다운 노드 기반 실시간 협업 캔버스. 4인 / 4주. pnpm 모노레포.

## Canonical sources (이 파일에 복제 금지 — 아래를 정본으로 참조)
- 설계 문서: `Docs/` (`01-Proposal` ~ `10-Team-Roles`)
- 데이터 모델: `Docs/08-ERD.md` ↔ `apps/api/prisma/schema.prisma`
- API 규격: `Docs/09-API-Spec.md`
- 아키텍처: `Docs/06-Backend-Architecture.md` · `Docs/07-Frontend-Architecture.md`
- 역할/경계: `Docs/10-Team-Roles.md`
- 경로별 상세 불변식: `.claude/rules/`

## 구조
- `apps/api` — 백엔드 (Express + Socket.io + Prisma)
- `apps/web` — 프론트 (React + Vite + React Flow + Zustand + Tailwind)
- `packages/shared` — BE↔FE 공용 타입/DTO/소켓 이벤트 (계약)

## Standard commands
- 환경 셋업: `./scripts/bootstrap`
- 검증: `./scripts/check`
- 테스트: `./scripts/test`
- 개발 서버: `pnpm dev:api` / `pnpm dev:web`

## Non-negotiable rules
- 생성물 직접 편집 금지: `node_modules/`, `**/dist/`, `apps/api/prisma/migrations/`, Prisma client.
- push · merge · deploy · 프로덕션 데이터 변경 금지.
- 스키마 변경은 Prisma 마이그레이션 + 롤백 설명 + `Docs/08-ERD.md` 동시 갱신.
- `packages/shared` DTO/이벤트 변경은 BE·FE 양쪽 + `Docs/09-API-Spec.md` 동시 갱신.
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
