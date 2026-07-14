# ADR-0001: 액세스 토큰 저장·갱신 전략

- **날짜**: 2026-07-14
- **상태**: 승인됨
- **관련 기능**: account-auth-improvements

## 맥락
BE에 refresh 토큰 시스템(login/signup/refresh/logout 엔드포인트 + httpOnly 쿠키 + 토큰 스토어)이 구현돼 있으나, 프론트가 이를 사용하지 않는다. `lib/api`에 `credentials:include`가 없어 refresh 쿠키가 서버로 가지 않고, `/auth/refresh`를 호출하는 곳이 없다. 그 결과 access token(TTL 7일)이 localStorage에 장기 방치되고(`authStore` persist), 로그아웃해도 서버 세션이 무효화되지 않는다. "브라우저를 닫아도 로그인이 유지된다"는 현상은 이 방치된 7일 토큰이 원인이다. 세션 유지 방식을 다시 정해야 한다.

## 검토한 대안
1. **sessionStorage에 access 저장** — 브라우저/탭 닫으면 소멸.
   - 장점: 구현 최소(한 줄), "닫으면 로그아웃".
   - 단점: 탭별 격리로 새 탭·북마크 진입 시 재로그인(협업앱에 부적합), **보안 개선 없음**(JS로 읽히는 건 동일, 수명만 바뀜), refresh 인프라를 여전히 방치.
2. **localStorage 유지 + access TTL만 15분으로 단축** — 최소 변경.
   - 장점: 기존 저장/rehydrate 코드 유지, refresh 흐름만 추가.
   - 단점: 15분짜리 토큰이 JS로 읽히는 저장소에 계속 노출(XSS 표면 잔존).
3. **access는 메모리 보관 + refresh 부팅 복원** *(선택)* — access를 JS 메모리(Zustand, persist 제거)에만 두고, 앱 부팅 시 `/auth/refresh`(+`/auth/me`)로 세션 복원.
   - 장점: JS로 읽히는 저장소에 토큰 흔적 0(XSS 표면 최소), 노출 창 7일→15분, refresh 인프라 활용, 협업앱에 맞는 "로그인 유지" 유지(30일 쿠키).
   - 단점: 새로고침마다 refresh 1회(수십 ms) + 부팅 중 짧은 로딩 상태 필요, ProtectedRoute가 부팅 완료를 대기해야 함.

## 결정
**3안(메모리 보관 + refresh 부팅 복원)** 을 채택한다.
- refresh 시스템이 이미 구현돼 있어 "완성"에 가깝고, access 노출 창을 7일→15분으로 실질적으로 줄인다.
- 협업 캔버스 앱은 로그인 유지가 정상 UX라 sessionStorage(1안)는 부적합.
- 2안 대비 JS 저장소 노출을 완전히 제거해 보안 이득이 크다. 비용(부팅 refresh 1회)은 수용 가능.

## 결과
- `authStore`에서 `persist` 미들웨어를 제거하고, access token을 메모리 상태로만 보관한다.
- `authStore`에 부팅 상태(`isBootstrapping`)를 추가하고, 앱 진입 시 `/auth/refresh` → 성공 시 `/auth/me`로 user를 복원한다. `ProtectedRoute`는 부팅이 끝나기 전에는 리다이렉트하지 않는다(새로고침 시 `/login` 깜빡임 방지).
- `lib/api`는 `credentials:include` + 401 시 단일 `/auth/refresh` 후 원요청 재시도 로직을 갖는다.
- 배포 환경(web·api 상이 도메인)에서 동작하려면 refresh 쿠키가 `sameSite:none`+`secure`여야 한다(BE 이슈).
- access TTL 15분 단축은 BE의 `JWT_EXPIRES_IN` 변경에 의존한다(BE 이슈). F2는 mock으로 401→refresh 흐름을 검증한다.
