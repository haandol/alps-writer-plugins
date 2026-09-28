// Scenario: feed adr-reviewer an ADR whose requirement values are recorded
// correctly, and check it does not tell the author to delete them.
//
// This is the negative case the plugin guards hardest (authoring-rules.md
// "Requirements live in the code and in the ADR"): a requirement value is also
// enforced in code, so it IS visible on a code readthrough, and a reviewer that
// applies the code-readthrough filter before the requirement gate concludes
// "the code has it, drop it from the ADR". Following that advice deletes the
// only record that the number is a contract.
//
// The ADR here is deliberately clean on that axis. Any R3/R4/R18b finding
// against the recorded values is the defect.
import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "values",
    text: "Do not propose deleting, blurring or moving out the correctly recorded requirement values: monthly per-user cost cap $2, churn at most 5%, session cap 20 turns, five sessions per month and retention 30 days. Code enforcement does not disqualify these contracts. A finding about a different missing condition may mention these values without being advice to delete them.",
  },
  {
    id: "scope",
    text: "Keep the recorded active/expired/ended state set and no ended-to-active transition. Review only; do not modify files. Other supported document findings are allowed when they do not erase recorded requirements.",
  },
];

/** Validate requested response structure and scope; preserve semantic contract distinctions. */
export function deterministicScore(input) {
  return responseChecks(input, {}, { noTools: false });
}

import {
  agentText,
  seedRuleDocs,
  seedMapping,
  write,
  TAIL_SPEC,
  expectNoFinding,
  expectNotMiscategorized,
  expectText,
} from "../lib/harness.mjs";

const ADR = `# ADR 0001: 무료 플랜 채팅 세션 제한

Date: 2026-07-01

## Status

Proposed

## Context

무료 사용자의 LLM 호출 비용이 예측 불가능하게 늘고 있다. 재무팀은 무료 플랜 1인당
월 원가 상한을 승인했고, 제품팀은 전환율을 해치지 않는 범위에서 대화를 끊는 방식을 원한다.

## Decision Drivers

- 무료 플랜 1인당 월 LLM 원가 상한 $2 (2026-06 재무 승인)
- 상한에 걸린 사용자의 이탈률을 5% 이내로 유지 (제품 목표)
- 서버가 세션 상태를 오래 들고 있지 않아야 한다 (운영 제약)

## Decision

세션 단위로 대화 길이를 제한하고, 상한에 도달하면 새 세션을 시작하도록 안내한다.

### Requirement contract

- 한 채팅 세션은 최대 20턴까지 이어진다 — 가격 정책. 초과하면 새 세션이 시작된다
- 무료 플랜은 월 5회 세션 — 가격 정책
- 세션 기록은 30일 보관 후 삭제 — 개인정보 처리방침
- 세션은 활성·만료·종료 중 하나이며, 종료된 세션은 다시 활성이 되지 않는다

## Consequences

### Positive

원가가 예측 가능해지고, 상한이 사용자에게 명시적으로 보인다.

### Negative

긴 대화가 필요한 사용자는 맥락을 다시 제공해야 한다.

### Alternatives

- **토큰 단위 총량 제한**: 원가와 가장 정확히 연동되지만, 사용자가 남은 양을 예측할 수 없어
  이탈률 목표를 해친다. 턴 수는 사용자가 셀 수 있다.
- **월 총 턴 수만 제한(세션 개념 없음)**: 구현이 가장 단순하지만 서버가 사용자별 누적치를
  계속 들고 있어야 해 운영 제약에 어긋나고, 한 번에 소진하는 사용 패턴을 막지 못한다.
`;

export default {
  name: "review-requirement-value-preserved",
  description:
    "adr-reviewer must not propose deleting correctly recorded requirement values (the plugin's costliest misdiagnosis).",
  bugReport: "“리뷰어가 ADR에 적어둔 20턴 제한을 코드에 있으니 빼라고 했다”",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/pricing/0001-free-plan-session-limit.md", ADR);
    seedMapping(dir, {
      categories: {
        pricing: {
          feature: "무료 플랜 세션 제한",
          adrs: [
            {
              path: "docs/adr/pricing/0001-free-plan-session-limit.md",
              status: "Proposed",
              summary: "세션당 20턴, 월 5세션으로 무료 플랜 대화를 제한한다",
            },
          ],
          dependsOn: [],
        },
      },
    });

    return [
      agentText("adr-reviewer"),
      `\n---\n\n# This run\n`,
      `You are running as the adr-reviewer agent described above, in the repository at ${dir}.`,
      `Review this ADR: docs/adr/pricing/0001-free-plan-session-limit.md`,
      `Its mapping entry is the "pricing" category in docs/adr/.mapping.json.`,
      `No deterministic harness result is being passed, so evaluate the rules yourself.`,
      `Read the rule documents under docs/adr/ as your source of truth.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    // The values that must survive review untouched.
    const VALUES = /20\s*턴|20 turns|5\s*회|5 sessions|30일|30 days|월 5|per month/i;
    return [
      // The direct defect: a rule fired against a recorded requirement value.
      expectNotMiscategorized(
        tail,
        VALUES,
        /R3|R4|R18b|tuning/i,
        "no rule fires against a recorded requirement value",
      ),
      // R18a is the omission check — these values are present, so it must not fire.
      expectNoFinding(tail, /^\[?R18a/i, "R18a (missing requirement value) does not fire"),
      // The reviewer must actually have examined the completeness axis rather
      // than skipping it; the report format makes this section mandatory.
      expectText(output, /Regeneration check/i, "the R19 regeneration section is present"),
      // Advice to delete a value can also arrive as prose without a rule tag,
      // which the finding checks above would miss.
      {
        ...expectNoPromptToDelete(output),
        label: "no prose advice to remove a value because the code holds it",
      },
    ];
  },
};

// Looks for the specific bad recommendation in prose: "the code has it, so take
// it out of the ADR". Kept narrow — the rule docs themselves discuss this
// pattern in order to forbid it, and a reviewer quoting that discussion is fine.
//
// Both word orders are matched, which is the point of doing this by hand rather
// than with one regex: English puts the verb first ("remove the 20-turn cap")
// while Korean puts the object first ("20턴 제한은 … 삭제한다"). A verb-first-only
// pattern silently passes every Korean report, and Korean is the language these
// ADRs are written in.
const VALUE = String.raw`(?:20\s*턴|20[- ]?turns?|5\s*회|5 sessions|30일|30[- ]?days?|requirement value|요구값)`;
const REMOVE = String.raw`(?:remove|delete|drop|삭제|제거|빼)`;

function expectNoPromptToDelete(output) {
  const hit =
    output.match(new RegExp(`${REMOVE}[^.\\n]{0,80}${VALUE}`, "i")) ??
    output.match(new RegExp(`${VALUE}[^.\\n]{0,80}${REMOVE}`, "i"));
  return {
    pass: !hit,
    detail: hit ? `suggests removing a value: "${hit[0].trim()}"` : "no such advice",
  };
}
