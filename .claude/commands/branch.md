---
description: Linear 이슈 ID로 브랜치 자동 생성·체크아웃 (Linear branchName 사용 → PR 자동 링크) + 이슈 컨텍스트 로드
argument-hint: <IEUM-13>
allowed-tools: Bash(./scripts/lb.sh:*), Bash(git status:*), Read
---

Linear 이슈 **$1** 로 작업을 시작한다. 순서대로 수행하라.

1. `./scripts/lb.sh $1` 를 실행한다 → Linear가 만든 브랜치명으로 `origin/main` 기준 로컬 브랜치 생성·체크아웃.
   - 실패 시(키 미설정 등) 메시지를 그대로 보여주고, `.env`에 `LINEAR_API_KEY` 설정을 안내한 뒤 중단.
2. `git status -sb` 로 현재 브랜치를 확인한다.
3. 스크립트 출력의 이슈 제목·URL을 바탕으로 **무엇을 구현할지** 한두 줄로 정리하고, 컨벤션(`Docs/11-Conventions.md`)에 맞는 **커밋 메시지 예시**(`<type>(<scope>): 요약 [$1]`)를 제시한다.
4. 시작 전 상기: 작업 후 `./scripts/check` 통과 → 커밋 → push → PR. push·merge는 사람이.

> 브랜치명은 Linear가 생성한 것을 그대로 쓴다(이슈 ID 포함 → PR↔이슈 자동 링크). 별도 네이밍 불필요.
