// When /adr-impl rewrites an Accepted provider ADR for an admitted change, it
// settles the externally checkable assumption behind the change at its source
// before the baseline approval, shows that source in the semantic diff, cites it
// under Related, and does not record the contradicted figure as fact.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const ADR_PATH = "docs/adr/support/summaries/0001-summarize-with-acme-batch.md";
const MAPPING = {
  categories: {
    "support/summaries": {
      feature: "Daily consultation summaries",
      adrs: [
        {
          path: ADR_PATH,
          status: "Accepted (2026-10-20)",
          summary: "전날 상담 기록을 Acme Batch API로 요약해 09:00 전에 상담원에게 제공한다",
        },
      ],
      dependsOn: [],
    },
  },
};
const ADR = `# ADR 0001: 전날 상담 기록을 Acme Batch API로 요약

Date: 2026-10-01

## Status

Accepted (2026-10-20)

## Purpose

상담원은 09:00 업무 시작 전에 전날 상담 기록 요약을 받아야 한다(운영 계약). 하루 기록은 최대 약 20,000건이다.

## Decision Drivers

- 02:00에 시작해 09:00 전에 모든 요약이 도착해야 한다.
- 요약 비용을 줄여야 한다.

## Decision

매일 02:00에 전날 기록을 Acme Batch API 한 배치로 제출하고, 결과를 상담원 화면에 올린다.

### Requirement contract

#### 필수 보장

| 의무 | 관찰 가능한 검증 기준 |
| --- | --- |
| R1. 상담원은 09:00 전에 전날 기록 전부의 요약을 받는다. | 09:00 시점에 대상 기록 수와 받은 요약 수가 같다. |

## Alternatives

1. **Acme Realtime API** — 비용이 두 배라 채택하지 않았다.

## Consequences

### Positive

- 요약 비용이 실시간 호출의 절반이다.
`;
const TERMS_PATH = "vendor/acme-ai/service-terms.md";
const TERMS = `# Acme AI service terms (vendored copy, retrieved 2026-11-01)

## Batch API

- Acme completes a batch within 24 hours of submission. Acme offers no shorter completion guarantee.
- Batch requests cost 50% of the realtime price.

## Realtime API

- Each request returns its response synchronously.
- An organization may send at most 500 requests per minute.
`;

export const obligations = [
  {
    id: "checks-source",
    text: "Before asking for the baseline approval, the reply reports that it checked the vendored Acme AI service terms and that they allow at most 500 realtime requests per minute per organization, so about 20,000 records take at least about 40 minutes. It does not ask the user to confirm the rate limit that the source already settles.",
  },
  {
    id: "contradicted-not-fact",
    text: "The proposed ADR revision does not record the user's 2,000-requests-per-minute figure or the ten-minute estimate as fact; it uses the source's limit and says the user's figure is contradicted by it.",
  },
  {
    id: "semantic-diff",
    text: "The reply presents the change as a semantic diff of the existing ADR (Decision, requirement contract, Decision Drivers, Consequences), states that the ADR returns to Proposed, and asks for the baseline approval before any code is written.",
  },
  {
    id: "related-citation",
    text: "The proposed revision cites the vendored Acme AI service terms under Related as the source of the rate limit that decides the choice.",
  },
];

export default {
  name: "impl-edit-checks-external-premise",
  agentTimeoutMs: 600_000, // reads the rule documents, the ADR and the vendored terms
  description:
    "When /adr-impl rewrites an Accepted provider ADR, it checks the externally verifiable assumption behind the change at its source before baseline approval, shows and cites the source, and keeps a contradicted figure out of the facts.",
  bugReport:
    "provider를 바꾸는 ADR 수정에서 사용자가 말한 처리량을 그대로 적었고, 구현하면서야 약관 한도와 다르다는 걸 알았다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, { [ADR_PATH]: ADR });
    mkdirSync(path.join(dir, path.dirname(TERMS_PATH)), { recursive: true });
    writeFileSync(path.join(dir, TERMS_PATH), TERMS);
    return [
      skillText("adr-impl", {
        references: ["skills/adr-impl/references/target-and-change.md"],
      }),
      `\n---\n\n# This run\n`,
      `You are executing /adr-impl in the repository at ${dir}, with the argument: support/summaries`,
      `The fixture tools can list, read and search repository files, including ${TERMS_PATH} (a vendored copy of the provider terms).`,
      ``,
      `The user says: "요약을 Acme Realtime API로 바꾸자. 실시간 API는 조직당 분당 2,000건까지 된다고 들었으니 20,000건을 10분이면 끝낼 수 있어. 배치는 09:00을 못 맞출 때가 있어."`,
      ``,
      `This is a NON-INTERACTIVE, READ-ONLY run: do not write or edit any file and do not implement code.`,
      `Carry the cycle up to the baseline approval you would request for the rewritten ADR, and present it in your reply.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
