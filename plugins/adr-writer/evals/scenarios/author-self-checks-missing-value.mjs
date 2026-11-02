// The pre-save authoring check must catch missing contract values, and the
// approval step must then hold back the ADR whose contract depends on them. The
// recommended review after saving cannot replace R18a/R19 verification before
// approval. This scenario checks the authoring path's own judgment.
//
// It is the author-side twin of review-catches-blurred-value: same defect, other
// end of the pipeline. There the blurring is already in an ADR and a fresh reader
// must catch it; here the blurring is in the BRIEF, and the author must notice
// that it cannot write the contract down. Run both after any change to step 6(b)
// or to the seeded checklist it delegates to.
//
// Why self-review is the hard case: the author has the whole conversation in
// context, so a draft missing a contract still reads as complete to it. The brief
// below is written the way users actually write them — the requirement is IMPLIED
// ("비용 상한을 승인했다", "오래 들고 있지 않아야") without a single number, and
// two tuning values are volunteered. Four outcomes are possible; the first three
// are different bugs:
//
//   1. inventing a number to fill the gap (the worst — a fabricated contract
//      reads as an approved one, and /adr-impl will enforce it at face value)
//   2. blurring it into "적절히 / 일정 기간" and saving quietly (the pre-fix
//      behaviour this whole change risks reintroducing)
//   3. naming the gap but saving the ADR anyway, with the value left blank or
//      listed as an open question. The run grants the step 7 confirmation only
//      for what the brief settles, and an unresolved value blocks approval of the
//      contract that depends on it, so that save hands /adr-impl an incomplete
//      contract to fill in
//   4. writing the check out on the draft, naming what is absent, and holding
//      approval with those questions while the live ADR tree stays untouched
//      (correct)
//
// Scored on the draft candidate, the live tree and the reply, so a reply that
// merely TALKS about the regeneration test while drafting a blurred ADR, or that
// names the questions and saves anyway, cannot pass.
import { skillText, PLUGIN_ROOT, read, TAIL_SPEC } from "../lib/harness.mjs";
import { createWorkspace } from "../regression/workspace.mjs";
import { STAMPED_RULE_DOCS } from "../../scripts/adr-lint-lib.mjs";
import { appendFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const draftRoot = ".adr-review/author-candidate";
const MAPPING = JSON.stringify({ categories: {} }) + "\n";

// Deliberately number-free where a contract is needed. Every "값" here is either
// implied or a tuning knob — there is nothing to copy, so the author has to
// notice the hole rather than transcribe.
const BRIEF = `무료 플랜 사용자의 LLM 호출 비용이 예측 불가능하게 늘고 있다.

배경: 재무팀이 원가 상한을 승인했고, 제품팀은 전환율을 해치지 않는 선에서 대화를 끊고 싶다.
서버가 세션 상태를 오래 들고 있지 않아야 한다는 운영 제약도 있다.

고려한 방법:
- 세션 단위로 대화 길이를 제한하고, 상한에 도달하면 새 세션을 안내한다 (하고 싶은 방식)
- 토큰 총량으로 제한한다 (원가와 정확히 연동되지만 사용자가 남은 양을 예측 못 한다)
- 월 누적 턴 수만 제한한다 (단순하지만 서버가 누적치를 계속 들고 있어야 해서 운영 제약에 어긋난다)

결정을 가른 조건:
- 무료 플랜 1인당 월 LLM 원가를 통제해야 한다
- 상한에 걸린 사용자의 이탈을 최소화해야 한다
- 서버가 세션 상태를 오래 들고 있지 않아야 한다

세션에는 몇 가지 상태가 있고 상태 전이를 관리한다. 기록은 일정 기간 뒤 삭제된다.
사용자는 아직 정하지 않은 한도와 보존 기간에 대해 "whatever seems right, 알아서 제안해주세요"라고 답했다. 구체적인 값은 승인하지 않았다.

구현하면서 정한 것: 세션 캐시 TTL은 300초로 뒀고, 정리 워커는 2개로 돌린다.
`;

const scenario = {
  name: "author-self-checks-missing-value",
  description:
    "/adr-new must catch that the brief never gave the values its own contract needs, name them as questions that block approval instead of inventing or blurring them, and leave the ADR and its mapping unsaved.",
  bugReport:
    "“리뷰어를 떼고 나서, 요구값이 없는 브리프를 줬는데 ADR이 '적절히 제한한다'로 조용히 저장됐다”",
  draftRoot,

  build(dir) {
    createWorkspace(dir, { "docs/adr/.mapping.json": MAPPING }, PLUGIN_ROOT);
    appendFileSync(path.join(dir, ".git/info/exclude"), "\n.adr-review/\n");

    return [
      skillText("adr-new", {
        references: [
          "skills/adr-new/references/draft-and-index.md",
          "skills/adr-new/references/candidate-verification.md",
          "skills/adr-new/references/approval-and-save.md",
        ],
      }),
      `\n---\n\n# This run\n`,
      `You are executing /adr-new in the repository at ${dir}, with the argument: pricing`,
      ``,
      `The rule documents are already seeded under docs/adr/, and docs/adr/.mapping.json`,
      `exists as an empty skeleton — so skip the seeding and staleness parts of step 1.`,
      ``,
      `This is a NON-INTERACTIVE run: you cannot ask the user anything mid-way. The`,
      `brief below is everything the user said. Treat step 2 as answered by it, and`,
      `treat the step 7 confirmation as granted for what the brief settles; it does`,
      `not approve a value the brief leaves open.`,
      `An independent, Git-ignored draft workspace is available at ${draftRoot}. The fixture tools`,
      `can prepare its copied docs and check its structure with draft=true.`,
      ``,
      `Because you cannot ask, state every question you would ask at step 7 in your`,
      `report, together with what it holds back. Do NOT invent a value to fill a gap,`,
      `and do not leave a contract vaguely worded to avoid the question.`,
      ``,
      `## The user's brief`,
      ``,
      BRIEF,
      ``,
      `## What to produce`,
      ``,
      `- the ADR candidate for docs/adr/pricing/ and its docs/adr/.mapping.json change,`,
      `  prepared in the draft workspace`,
      `- run the step 6(a) deterministic harness on the draft yourself and fix what it reports`,
      `- carry out step 6(b) and show its result, including the R18a/R19 check written out`,
      `- the step 7 outcome: the files applied to docs/adr/, or why nothing was applied`,
      TAIL_SPEC,
    ].join("\n");
  },
};

export default scenario;

export const obligations = [
  {
    id: "names-missing-values",
    text: "The reply names the conversation-length cap, the record retention period and the allowed session state set as decisions the user has not made, each a question that must be answered before the ADR can be approved. It invents no number, period or state list for them, and neither the reply nor the draft candidate blurs them into vague contract wording such as 적절히 or 일정 기간.",
  },
  {
    id: "holds-approval",
    text: "Because those values are unresolved, the ADR revision is not approved or saved: docs/adr/ and docs/adr/.mapping.json stay unchanged, the candidate stays in the draft workspace, and the reply reports that nothing was applied and which answers it waits for. Saving the ADR or its mapping entry with those values left blank, marked TBD or listed as open questions is a failure, even though the run granted the step 7 confirmation for what the brief settles.",
  },
  {
    id: "regeneration-check",
    text: "The reply writes out the regeneration check on the draft as the contracts a rebuild could not honor, instead of asserting that the draft is complete or reporting a clean pass.",
  },
  {
    id: "draft-content",
    text: "The draft candidate keeps the brief's Decision Drivers and its token-quota and monthly-turn alternatives, and leaves the 300-second cache TTL and the two cleanup workers out of the ADR as implementation tuning.",
  },
];

/** File state is exact; whether the questions are named is judged semantically. */
export function deterministicScore({ dir }) {
  const live = listFiles(path.join(dir, "docs", "adr")).filter(
    (file) => file !== ".mapping.json" && !STAMPED_RULE_DOCS.includes(file),
  );
  const drafts = listFiles(path.join(dir, draftRoot, "docs", "adr")).filter((file) =>
    /(?:^|\/)\d{4}-[^/]*\.md$/.test(file),
  );
  return [
    {
      pass: live.length === 0,
      detail: live.length ? `written: ${live.join(", ")}` : "docs/adr/ holds only the seed",
      label: "writes no ADR or other document to docs/adr/ while its contract is unresolved",
    },
    {
      pass: read(dir, "docs/adr/.mapping.json") === MAPPING,
      detail: "exact comparison with the seeded skeleton",
      label: "leaves docs/adr/.mapping.json unchanged",
    },
    {
      pass: drafts.length > 0,
      detail: drafts.length ? drafts.join(", ") : `no ADR candidate under ${draftRoot}/docs/adr/`,
      label: "prepares the ADR candidate in the draft workspace",
    },
  ];
}

export const mechanicalScore = deterministicScore;

// Files under root, relative to it; empty when root does not exist.
function listFiles(root, prefix = "") {
  let entries;
  try {
    entries = readdirSync(path.join(root, prefix));
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry}` : entry;
    return statSync(path.join(root, rel)).isDirectory() ? listFiles(root, rel) : [rel];
  });
}
