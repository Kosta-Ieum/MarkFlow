---
feature: account-auth-improvements
status: approved
created: 2026-07-14
---

# 계정/인증 개선 — 요구사항

## 1. Overview

### 문제 정의
- **세션 관리 미완성**: BE에 refresh 토큰 시스템(엔드포인트·httpOnly 쿠키·토큰 스토어)이 구현돼 있으나 프론트가 이를 사용하지 않는다. `lib/api`는 `credentials:include`가 없어 refresh 쿠키를 서버로 보내지 않고, `/auth/refresh`를 호출하는 곳이 없으며, 401을 받으면 즉시 로그아웃시킨다. 그 결과 access token(현재 TTL 7d)이 localStorage에 장기 방치되고, 로그아웃해도 서버 세션(refresh 토큰)이 무효화되지 않는다.
- **프로필 관리 부재**: 사용자가 가입 후 자신의 정보를 조회하거나 표시 이름(nickname)을 변경할 화면이 없다.
- **표시 이름 부재**: 협업 화면(채팅·멤버 목록·커서)에 계정 `name`이 그대로 노출된다. 공개용 표시 이름(nickname)이 없다.

### 목표
- access token 노출 창을 7일 → 15분으로 축소하고, 만료 시 사용자가 체감하지 못하게 자동 갱신한다.
- 로그아웃이 서버 세션까지 완전히 무효화하도록 만든다.
- 사용자가 프로필 페이지에서 내 정보를 조회하고 nickname을 변경할 수 있게 한다.
- 회원가입 시점부터 nickname을 받아 저장하고, 협업 화면에 nickname을 표시한다.

### Non-goals
- **비밀번호 변경** — 일단 제외(후속 spec).
- **이름(name) 변경** — 프로필 편집은 nickname만. name은 가입 시 설정(후속에 편집 검토).
- 회원 탈퇴(계정 삭제) — 소유 프로젝트 cascade/소유권 이전 파급이 커 별도 spec.
- 프로필에서 이메일 변경 — 로그인 식별자 + OTP 재인증 필요, 별도 spec.
- 커서/캔버스 presence의 nickname 표시 — F1(캔버스·실시간) 도메인, 별도 분리.
- BE(apps/api) 구현 자체 — 본 spec은 F2 관점의 계약·요구를 정의하고, apps/api 변경은 **BE 멤버가 별도 이슈로 등록·진행**(사용자는 F2).
- nickname 유니크 강제 — 표시용 비유니크.

### 성공 기준
- access token 15분 만료 후에도 API 호출이 자동 refresh→재시도로 끊김 없이 성공한다(재로그인 없음).
- 로그아웃 후 기존 refresh 쿠키로 `/auth/refresh`가 거부된다.
- 프로필 페이지에서 nickname 변경이 반영된다.
- 신규 가입 시 nickname이 필수로 입력·저장되고, 채팅·멤버 목록에 nickname이 표시된다(없으면 name fallback).

### 역할 경계 (구현 소유)
- **F2 (본 세션 구현)**: refresh 클라이언트(`lib/api`·`authStore`), 프로필 페이지(조회+nickname 변경), 가입/로그인 폼 nickname 입력, 채팅·멤버 목록 nickname 표시.
- **BE (BE 멤버 담당, 별도 이슈)**: access TTL 15m, refresh 쿠키 `sameSite:none`+`secure`, `PATCH /users/me`(nickname), User.nickname 컬럼+마이그레이션+백필, signup nickname 저장, 로그인/가입/조회 응답 User에 nickname 포함, `openapi.yaml`·`Docs/08`·`Docs/09` 갱신.
- **계약 (packages/shared, openapi)**: BE 이슈에 포함(openapi가 apps/api 소속). F2는 확정된 계약을 소비.
- **F1 (별도)**: 커서 presence nickname 표시.

> **로그인 엔드포인트 로직 자체는 수정 없음** — 로그인이 공유하는 공통 경로(access TTL·`setRefreshCookie` 쿠키 정책·User 직렬화의 nickname 포함)만 R1·R5 작업에 묻어서 바뀐다.

## 2. 요구사항

### R1. 자동 세션 유지 (access token 갱신)

**유저스토리:** 로그인한 사용자로서, 짧은 access token이 만료돼도 다시 로그인하지 않고 작업을 계속하기 위해, 투명한 토큰 자동 갱신을 원한다.

**인수 조건:**
- R1.1 WHEN 인증이 필요한 API 요청을 보낼 때, THE SYSTEM SHALL `credentials:"include"`로 요청하여 refresh 쿠키가 서버로 전송되게 한다.
- R1.2 WHEN access token 만료로 API가 401을 반환하면, THE SYSTEM SHALL `/auth/refresh`를 1회 호출해 새 access token을 발급받고 원래 요청을 자동 재시도한다.
- R1.3 IF `/auth/refresh`가 실패(401)하면, THEN THE SYSTEM SHALL 로컬 인증 상태를 비우고 `/login`으로 이동시킨다.
- R1.4 WHEN 앱이 부팅(최초 로드/새로고침)될 때 access token이 없으면, THE SYSTEM SHALL `/auth/refresh`를 1회 시도해 세션을 복원한다(쿠키가 유효하면 로그인 유지, 아니면 비로그인 상태).
- R1.5 THE SYSTEM SHALL access token을 브라우저 영속 저장소(localStorage)에 보관하지 않는다(메모리 보관).
- R1.6 WHILE 동시에 여러 요청이 401을 받는 동안, THE SYSTEM SHALL refresh를 중복 호출하지 않고 단일 갱신을 공유한다.

### R2. 완전한 로그아웃

**유저스토리:** 사용자로서, 로그아웃하면 서버 세션까지 확실히 종료되기를 원한다.

**인수 조건:**
- R2.1 WHEN 사용자가 로그아웃하면, THE SYSTEM SHALL `credentials:"include"`로 `/auth/logout`을 호출하여 서버가 refresh 토큰을 폐기하게 한다.
- R2.2 WHEN 로그아웃이 완료되면, THE SYSTEM SHALL 메모리의 access token과 인증 상태를 비운다.
- R2.3 IF 로그아웃 후 기존 refresh 쿠키로 `/auth/refresh`를 시도하면, THEN THE SYSTEM SHALL(서버) 이를 거부한다. *(BE 이슈에서 보장)*

### R3. 프로필 조회

**유저스토리:** 로그인한 사용자로서, 내 계정 정보를 확인하기 위해 프로필 페이지를 원한다.

**인수 조건:**
- R3.1 WHEN 사용자가 프로필 페이지에 진입하면, THE SYSTEM SHALL `GET /auth/me`로 내 정보(name, email, nickname, 가입일)를 조회해 표시한다.
- R3.2 THE SYSTEM SHALL email과 name을 읽기 전용으로 표시한다(수정 불가).
- R3.3 IF 조회가 401로 실패하면, THEN THE SYSTEM SHALL R1의 refresh 흐름을 따른다.

### R4. nickname 변경 (프로필)

**유저스토리:** 사용자로서, 협업 화면에 보일 표시 이름을 바꾸기 위해 프로필에서 nickname 변경을 원한다.

**인수 조건:**
- R4.1 WHEN 사용자가 새 nickname을 제출하면, THE SYSTEM SHALL `PATCH /users/me`로 nickname을 갱신하고 결과를 화면·인증 상태에 반영한다.
- R4.2 IF nickname이 검증 규칙(2~20자, 공백 trim)을 위반하면, THEN THE SYSTEM SHALL 제출을 막고 오류를 표시한다.
- R4.3 WHEN 갱신이 성공하면, THE SYSTEM SHALL 별도 새로고침 없이 변경된 nickname을 즉시 반영한다(응답 기반).

### R5. 회원가입 시 nickname 입력·저장

**유저스토리:** 신규 사용자로서, 협업 화면에 보일 표시 이름을 정하기 위해 가입 시 nickname 입력을 원한다.

**인수 조건:**
- R5.1 WHEN 회원가입 폼을 표시할 때, THE SYSTEM SHALL name과 별개로 nickname 입력 필드를 함께 제공한다.
- R5.2 WHEN 사용자가 가입을 제출하면, THE SYSTEM SHALL nickname을 `SignupRequest`에 포함해 전송하고, 서버는 이를 User.nickname에 저장한다. *(저장은 BE 이슈)*
- R5.3 IF nickname이 검증 규칙(2~20자, 공백 trim)을 위반하면, THEN THE SYSTEM SHALL 제출을 막고 오류를 표시한다.
- R5.4 WHEN 로그인/가입 응답을 받으면, THE SYSTEM SHALL 응답의 `User`에 포함된 nickname을 인증 상태에 보관한다.

### R6. nickname 표시 (F2 범위: 채팅·멤버 목록)

**유저스토리:** 협업 참여자로서, 다른 사람을 표시 이름으로 알아보기 위해 채팅·멤버 목록에 nickname 표시를 원한다.

**인수 조건:**
- R6.1 WHEN 채팅 메시지 작성자를 표시할 때, THE SYSTEM SHALL nickname을 표시하되 nickname이 없으면 name으로 fallback한다(`nickname ?? name`).
- R6.2 WHEN 멤버 목록을 표시할 때, THE SYSTEM SHALL 각 멤버를 `nickname ?? name`으로 표시한다.
- R6.3 THE SYSTEM SHALL nickname 소비를 위해 `UserRefSchema`(채팅·프레즌스의 user ref)에 nickname(optional)을 포함한 계약을 사용한다. *(계약 확정은 BE 이슈)*

### R7. 배포 환경 cross-site 쿠키 (비기능/배포)

**유저스토리:** 운영자로서, 배포 환경(web·api가 서로 다른 도메인)에서 refresh가 동작하도록 쿠키 정책이 cross-site를 지원하기를 원한다.

**인수 조건:**
- R7.1 WHEN 프로덕션에서 refresh 쿠키를 설정할 때, THE SYSTEM SHALL(서버) `sameSite:"none"` + `secure:true`로 설정한다. *(BE 이슈)*
- R7.2 IF cross-site 요청에서 쿠키가 전송되지 않으면, THEN 배포 환경에서 자동 갱신이 실패하므로, THE SYSTEM SHALL R7.1을 배포 전 필수 선행으로 취급한다.

### R8. 헤더 사용자 메뉴 (아바타 드롭다운) — F2

**유저스토리:** 로그인한 사용자로서, 헤더의 프로필 아이콘에서 빠르게 프로필로 이동하거나 로그아웃하기 위해 드롭다운 메뉴를 원한다.

**인수 조건:**
- R8.1 WHEN 사용자가 헤더 프로필 아바타를 클릭하면, THE SYSTEM SHALL "프로필 보기"·"로그아웃" 항목을 가진 드롭다운(아코디언식) 메뉴를 연다.
- R8.2 WHEN "프로필 보기"를 선택하면, THE SYSTEM SHALL `/profile`로 이동하고 메뉴를 닫는다.
- R8.3 WHEN "로그아웃"을 선택하면, THE SYSTEM SHALL R2의 로그아웃 흐름을 수행한다.
- R8.4 WHEN 메뉴 바깥을 클릭하거나 항목을 선택하면, THE SYSTEM SHALL 메뉴를 닫는다.
- R8.5 THE SYSTEM SHALL 아바타/메뉴에 표시되는 이름을 `nickname ?? name`으로 렌더한다.

### R9. 인증 사용자의 로그인/가입 화면 접근 차단 — F2

**유저스토리:** 이미 로그인한 사용자로서, 로그인/가입 화면을 다시 보지 않기 위해, 접근 시 앱 내부로 리다이렉트되기를 원한다.

**인수 조건:**
- R9.1 WHEN 인증된 사용자가 `/login` 또는 `/signup`에 접근하면, THE SYSTEM SHALL `/projects`로 리다이렉트한다.
- R9.2 WHILE 부팅 refresh가 진행 중이면, THE SYSTEM SHALL 인증 판단이 끝날 때까지 리다이렉트/폼 노출을 보류한다(로그인 폼 깜빡임 방지).
