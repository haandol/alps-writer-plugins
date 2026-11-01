// Fixtures that structure-lint.test.mjs and structure-lint.integration.test.mjs share.
import { write } from "./helpers.mjs";

// ── integration: CLI end-to-end ─────────────────────────────────────────
// A reusable clean fixture. inScope/mapping/README all consistent.
export function seedClean(dir) {
  write(
    dir,
    "docs/adr/identity/login/0001-password-policy.md",
    `# ADR 0001: 비밀번호 정책

Date: 2026-07-01

## Status
Accepted (2026-07-02)

## Context
가입 시 비밀번호 강도.

## Decision Drivers
- 크리덴셜 스터핑 방어
- 이탈률 5% 이내
- 보안 전문가 부재

## Decision
bcrypt, 최소 12자.

### 대안 검토
- bcrypt: 표준
- argon2: 최신

## Consequences
### Positive
- 강력

## Related
- [0002](./0002-rate-limit.md)
`,
  );
  write(
    dir,
    "docs/adr/identity/login/0002-rate-limit.md",
    `# ADR 0002: 레이트 리밋

Date: 2026-07-01

## Status
Proposed

## Context
무차별 대입 방어.

## Decision Drivers
- 초당 제한
- 정상 사용자 영향 최소
- 분산 고려

## Decision
토큰 버킷.

### 대안 검토
- 토큰 버킷
- 고정 윈도우

## Consequences
### Positive
- 방어력

## Related
- [0001](./0001-password-policy.md)
`,
  );
  write(
    dir,
    "docs/adr/.mapping.json",
    JSON.stringify({
      categories: {
        "identity/login": {
          feature: "Login",
          adrs: [
            {
              path: "docs/adr/identity/login/0001-password-policy.md",
              status: "Accepted (2026-07-02)",
              summary: "bcrypt 최소 12자",
            },
            {
              path: "docs/adr/identity/login/0002-rate-limit.md",
              status: "Proposed",
              summary: "토큰 버킷 레이트 리밋",
            },
          ],
          dependsOn: [],
        },
      },
    }),
  );
  // .mapping.json is the single ADR index; the README carries no ADR list.
  write(dir, "docs/adr/README.md", `# ADR\n\nADR 인덱스는 .mapping.json 참조.\n`);
}
