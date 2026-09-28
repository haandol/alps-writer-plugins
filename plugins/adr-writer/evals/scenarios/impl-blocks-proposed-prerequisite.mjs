import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "dependency",
    text: "Identify identity/login as the Proposed prerequisite of ordering/checkout, stop downstream implementation, and explain that the prerequisite must be implemented and become Accepted first. Merely proposing the right route does not authorize implementing checkout now.",
  },
  {
    id: "preservation",
    text: "Preserve the existing ADRs and mapping while reporting the dependency block. No implementation or state promotion is performed in this probe.",
  },
];

/** Exact output/scope checks supplement the semantic obligations. */
export function deterministicScore(input) {
  return responseChecks(input, {}, { noTools: false });
}

import {
  skillText,
  seedRuleDocs,
  seedMapping,
  write,
  TAIL_SPEC,
  expectText,
} from "../lib/harness.mjs";

function adr(title, status, decision) {
  return `# ADR 0001: ${title}

Date: 2026-08-15

## Status

${status}

## Context

이 결정은 downstream 동작의 선행 조건을 정의한다.

## Decision Drivers

- 선행 동작이 구현된 뒤에만 다음 동작을 시작해야 한다
- 부분 구현을 완료 상태로 오인하면 안 된다
- 의존성 순서는 매핑과 일치해야 한다

## Decision

${decision}

### Alternatives

1. **선행 구현 후 진행**
   - 장점: 완료 상태가 실제 동작과 일치한다.
   - 단점: downstream 작업이 대기한다.
2. **downstream 먼저 진행**
   - 장점: 파일을 먼저 만들 수 있다.
   - 단점: 동작하지 않는 scaffold가 완료 경로에 들어간다.

## Consequences

### Positive

구현 순서와 결정 순서가 일치한다.

### Negative

선행 구현이 끝날 때까지 대기할 수 있다.

## Related

- 없음
`;
}

export default {
  name: "impl-blocks-proposed-prerequisite",
  description:
    "/adr-impl must block a downstream target while its prerequisite is Proposed, even when the user asks to proceed anyway.",

  build(dir) {
    seedRuleDocs(dir);
    const prerequisite = "docs/adr/identity/login/0001-login.md";
    const target = "docs/adr/ordering/checkout/0001-checkout.md";
    write(dir, prerequisite, adr("로그인 선행 결정", "Proposed", "로그인 결정을 먼저 구현한다."));
    write(dir, target, adr("체크아웃 결정", "Proposed", "로그인 완료 후 체크아웃을 시작한다."));
    seedMapping(dir, {
      categories: {
        "identity/login": {
          feature: "Login",
          adrs: [{ path: prerequisite, status: "Proposed", summary: "로그인을 먼저 구현한다" }],
          dependsOn: [],
        },
        "ordering/checkout": {
          feature: "Checkout",
          adrs: [{ path: target, status: "Proposed", summary: "로그인 뒤 체크아웃을 구현한다" }],
          dependsOn: ["identity/login"],
        },
      },
    });

    return [
      skillText("adr-impl"),
      `\n---\n\n# This run`,
      `The user asks: "identity/login은 나중에 할게. ordering/checkout 파일과 API부터`,
      `checkout-only로 구현하고 완료 처리해줘."`,
      `Inspect the fixture and state what /adr-impl does before any code edit.`,
      `Use BLOCKED as the finding tag when the gate prevents downstream implementation.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const affirmativeOverride =
      /(checkout[- ]only|downstream).{0,100}(허용(?:한다|합니다)|진행(?:한다|합니다| 가능)|can proceed|may proceed|implement now|is allowed)/is.test(
        output,
      ) ||
      tail.findings.some((finding) =>
        /OVERRIDE_ALLOWED|ALLOW_DOWNSTREAM|PROCEED_DOWNSTREAM/i.test(finding.tag),
      );
    return [
      expectText(
        `${output}\n${tail.raw}`,
        /BLOCKED.{0,180}(identity\/login|Proposed|선행)/is,
        "blocks on the Proposed prerequisite",
      ),
      expectText(
        output,
        /(Accepted|구현 완료|implementation complete).{0,120}(before|먼저|뒤|후)|선행.{0,120}(Accepted|구현 완료|implementation complete)/is,
        "requires the prerequisite to become Accepted first",
      ),
      {
        pass: !affirmativeOverride,
        detail: affirmativeOverride
          ? "found an affirmative downstream-only override"
          : "no affirmative downstream-only override",
        label: "offers no user-confirmed downstream override",
      },
    ];
  },
};
