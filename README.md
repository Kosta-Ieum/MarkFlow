# MarkFlow

> 흩어진 아이디어를, 흐름으로.

FigJam식 무한 캔버스 위에서 마크다운(.md) 노드를 작성·연결하고, 멀티커서·채팅으로 실시간 협업하는 도구입니다. 스티키 메모보다 깊게, 문서보다 가볍게 — 접으면 요약, 펼치면 상세인 .md 노드로 아이디어의 밀도와 흐름을 동시에 잡습니다.

## 핵심 기능

- **마크다운 노드** — 접으면 제목+요약, 펼치면 코드 블록까지 담는 .md 노드
- **흐름 연결** — 노드를 엣지로 이어 아이디어를 플로우차트로
- **실시간 협업** — 멀티커서·소프트 락·채팅 (같은 캔버스에서 함께 작업)
- **휴지통·히스토리** — 소프트 삭제·복구·영구삭제 + 변경 활동 로그

## 기술 스택

| 영역 | 스택 |
| --- | --- |
| 프론트 | React · TypeScript · Vite · React Flow · Zustand · Tailwind |
| 백엔드 | Node.js · NestJS · Socket.io · Prisma |
| DB | PostgreSQL (Node/Edge 정규화) |
| 인증 | JWT (이메일/비밀번호) |

## 시작하기

```bash
git clone https://github.com/Kosta-Ieum/MarkFlow.git && cd MarkFlow
./scripts/bootstrap     # 전부 자동: .env·설치·DB(Docker)·Prisma·git lb 별칭
pnpm dev                # api + web 동시 실행
```
역할별 온보딩(`/onboard`)·Linear 브랜치(`git lb`) 등 자세한 흐름 → **[시작 가이드](./Docs/00-Getting-Started.md)**

## 문서

기획·설계 문서는 [`Docs/`](./Docs)에 있습니다.

| # | 문서 | 내용 |
| --- | --- | --- |
| 00 | [시작 가이드](./Docs/00-Getting-Started.md) | 클론·실행·온보딩 |
| 01 | [기획서](./Docs/01-Proposal.md) | 배경·목표·차별점 |
| 02 | [PRD](./Docs/02-PRD.md) | 제품 요구사항 |
| 03 | [기능 정의서](./Docs/03-Feature-Spec.md) | 기능 단위 추적표 |
| 04 | [화면 설계서](./Docs/04-Screen-Design.md) | 화면·인터랙션 ([screens/](./Docs/screens)) |
| 05 | [기술 설명서](./Docs/05-Tech-Spec.md) | 기술 개요 |
| 06 | [백엔드 아키텍처](./Docs/06-Backend-Architecture.md) | 레이어드 구조 |
| 07 | [프론트엔드 아키텍처](./Docs/07-Frontend-Architecture.md) | 상태·실시간 처리 |
| 08 | [데이터 모델 (ERD)](./Docs/08-ERD.md) | 스키마 ([.dbml](./Docs/08-ERD.dbml)) |
| 09 | [API 명세서](./Docs/09-API-Spec.md) | REST + Socket.io |
| 10 | [역할 분담](./Docs/10-Team-Roles.md) | 3인 협업 가이드 |
| 11 | [컨벤션](./Docs/11-Conventions.md) | 코딩·Git 규칙 |

> 일정·이슈는 **Linear**(워크스페이스 `kostateam2`)에서 관리합니다.

## 팀

3인 (백엔드 1 · 프론트 2) / 4주. 상세 → [역할 분담](./Docs/10-Team-Roles.md).
