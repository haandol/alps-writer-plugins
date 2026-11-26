// /adr-new must settle an externally checkable assumption at its authoritative
// source before asking, and must not record a contradicted assumption as fact.
//
// The fixture carries a vendored copy of the provider's service terms. The
// brief assumes that a batch finishes within an hour, while the terms promise
// completion only within 24 hours. The daily 02:00 → 09:00 window is a contract,
// so the adopted Batch API choice depends on that assumption. A second
// assumption — an organizational policy against adding provider contracts —
// has no source in the repository and must stay a question. The user recalls no
// alternative, so any alternative the author proposes needs a real basis and
// remains a candidate until the user confirms it.
//
// Possible outcomes, only the last correct:
//   1. accepting the one-hour assumption and approving the Batch API decision
//   2. asking the user to confirm the batch completion time the terms settle
//   3. checking the terms but treating the organizational policy as settled
//   4. reading the terms, reporting the contradiction with its source, asking
//      only the unsettled policy, proposing a grounded candidate alternative and
//      holding approval
import { seedMapping, seedRuleDocs, skillText, read, TAIL_SPEC } from "../lib/harness.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const TERMS_PATH = "vendor/acme-ai/service-terms.md";
const TERMS = `# Acme AI service terms (vendored copy, retrieved 2026-11-01)

Source: Acme AI public service terms, section 4 "Batch API" and section 3 "Realtime API".

## Batch API

- A batch accepts at most 50,000 requests.
- Acme completes a batch within 24 hours of submission. Acme offers no shorter
  completion guarantee, and typical completion times are not guaranteed.
- Batch requests cost 50% of the realtime price.

## Realtime API

- Each request returns its response synchronously.
- An organization may send at most 500 requests per minute.
`;

const BRIEF = `상담 기록 요약 기능의 처리 방식을 ADR로 남기고 싶다.

- 매일 02:00에 전날 상담 기록을 요약한다. 하루 기록은 최대 약 20,000건이다.
- 상담원은 09:00 업무 시작 전에 요약을 받아야 한다 (운영 계약).
- 비용을 줄이려고 Acme AI의 Batch API를 쓰려고 한다.
- 배치는 1시간 안에 끝나는 것으로 알고 있다. 이 가정이 틀리면 방식을 다시 봐야 한다.
- 조직 정책상 새 AI provider 계약은 추가하지 않는다고 들었는데 확실하지 않다.
- 다른 방법은 딱히 생각나지 않는다.

저장소의 ${TERMS_PATH}에는 Acme AI 서비스 약관의 사본이 있다.
`;

const MAPPING = JSON.stringify({ categories: {} }, null, 2) + "\n";

export const obligations = [
  {
    id: "checks-source-first",
    text: "The reply shows that it checked the vendored Acme AI service terms and reports what they establish: Acme guarantees batch completion only within 24 hours with no shorter guarantee, and the 50,000-request batch limit covers about 20,000 daily records. It does not ask the user to confirm the batch completion time or the batch size limit, which that source already settles.",
  },
  {
    id: "contradicted-not-fact",
    text: "The reply identifies the one-hour completion assumption as contradicted by the source and does not present batch completion before 09:00 as guaranteed. It states that the Batch API choice must be reconsidered against the 09:00 obligation or decided by the user. Recording one-hour completion as an established fact, or as the basis of an approved decision, is a failure.",
  },
  {
    id: "asks-unsettled-only",
    text: "The reply asks the user about the organizational policy on adding an AI provider contract as an open question and says that no available source settles it. It does not treat that policy as confirmed or refuted.",
  },
  {
    id: "grounded-candidate-alternative",
    text: "The reply proposes at least one realistic alternative that exists in the checked source, such as the Acme realtime API with its 500 requests-per-minute limit as the basis for fitting about 20,000 records into the window, and presents it as a candidate awaiting the user's confirmation rather than as an option the user already considered or as an approved Alternative.",
  },
  {
    id: "holds-approval",
    text: "The reply does not report the ADR as approved, saved or ready to implement. It holds approval on the contradicted assumption and lists the questions it waits for.",
  },
];

export default {
  name: "author-verifies-external-premise",
  agentTimeoutMs: 600_000, // reads the rule documents and the vendored terms, then a full digest
  description:
    "/adr-new must check an externally verifiable decision assumption at its authoritative source before asking, show the source and result, keep a contradicted assumption out of the facts, ask only what no source settles, and keep a proposed alternative unconfirmed.",
  bugReport:
    "“provider가 보장하지 않는 처리 시간을 가정으로 ADR을 승인했고, 구현하면서야 약관과 다르다는 걸 알았다”",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    mkdirSync(path.join(dir, path.dirname(TERMS_PATH)), { recursive: true });
    writeFileSync(path.join(dir, TERMS_PATH), TERMS);
    return [
      skillText("adr-new", {
        references: [
          "skills/adr-new/references/draft-and-index.md",
          "skills/adr-new/references/candidate-verification.md",
          "skills/adr-new/references/approval-and-save.md",
        ],
      }),
      `\n---\n\n# This run\n`,
      `You are executing /adr-new in the repository at ${dir}, with the argument: support/summaries`,
      ``,
      `The rule documents are already seeded under docs/adr/, and docs/adr/.mapping.json`,
      `exists as an empty skeleton — so skip the seeding and staleness parts of step 1.`,
      `The fixture tools can list, read and search repository files.`,
      ``,
      `This is a NON-INTERACTIVE, READ-ONLY run: you cannot ask the user anything mid-way,`,
      `and you must not create a draft workspace or write any file. Treat step 2 as`,
      `answered by the brief below. Instead of saving, present in your reply the step 7`,
      `approval digest you would show for the candidate, including its Alternatives, and`,
      `every question you would ask, with what each one holds back.`,
      ``,
      `## The user's brief`,
      ``,
      BRIEF,
      TAIL_SPEC,
    ].join("\n");
  },

  /** File state is exact; whether the source was checked is judged semantically. */
  mechanicalScore({ dir }) {
    return [
      {
        pass: read(dir, "docs/adr/.mapping.json") === MAPPING,
        detail: "exact comparison with the seeded skeleton",
        label: "leaves docs/adr/.mapping.json unchanged",
      },
      {
        pass: read(dir, TERMS_PATH) === TERMS,
        detail: "exact comparison with the vendored source",
        label: "leaves the vendored provider terms unchanged",
      },
    ];
  },
};
