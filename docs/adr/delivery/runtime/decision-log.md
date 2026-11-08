# Decision Log: delivery/runtime

This document is the **major decision-change history** of the delivery/runtime
category. Each ADR body describes only the current state, while the timeline of "what
changed and why" accumulates here, newest first. Git preserves the individual diffs.

## 2026-11-08 — 저장소 개발 도구까지 Bun으로 확장

- **Current ADR**: [run-plugins-and-tooling-on-bun](./0001-run-plugins-and-tooling-on-bun.md)
- **Change type**: requirement scope change
- **What**: 사용자 환경의 플러그인 실행물에 더해 저장소의 의존성 설치, 테스트, 빌드, 린트·포맷, 릴리스 도구와 git hook도 Bun과 Bun의 패키지 관리자·테스트 러너로 실행한다. 범위별 보안 고정은 패키지 전체 고정으로 바꾼다.
- **Why**: 사용자는 Node와 별도 패키지 관리자 없이 Bun 하나로 플러그인과 저장소를 모두 운영하기를 요청했다.
- **What is now void**: 실행물이 Node 기반 저장소 테스트에서도 동작하도록 표준 내장 모듈만 쓰라는 의무와, 저장소 개발 도구는 Node 24와 기존 패키지 관리자를 유지한다는 금지.
