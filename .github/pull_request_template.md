## 목적


## 변경 파일


## 영향 도메인
<!-- apps/api · apps/web · packages/shared · prisma 중 해당 -->


## 테스트 결과


## 호환성 / 마이그레이션 / 보안 위험


## 미검증 사항


---
- [ ] `./scripts/check` 통과
- [ ] 스키마 변경 시 `Docs/08-ERD.md` 갱신 + 마이그레이션(+롤백 설명)
- [ ] `packages/shared` 계약 변경 시 BE·FE 양쪽 + `Docs/09-API-Spec.md` 갱신
- [ ] 권한 변경 시 REST + Socket 양쪽
- [ ] 생성물(dist/migrations/prisma client) 직접 수정 없음
