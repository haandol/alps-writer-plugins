import { authorArtifactChecks } from "../skills/mechanical-checks.mjs";
// Scenario: the generate-then-evaluate direction.
//
// Instead of handing the agent a finished ADR, hand it /adr-new's authoring
// instructions plus a decision brief, and score the ADR it WRITES. Two things
// get checked, and they are different kinds of check:
//
//   1. the shipped deterministic harness runs over the result — the same lint a
//      hand-written ADR faces (structure, Status, drivers, alternatives, and the
//      value-as-constant warning). No LLM judgement involved.
//   2. the values from the brief survive verbatim, and the things that belong
//      one level down (the constant name, the pool size) do not appear. The
//      semantic judge checks this from the written ADR (the `values` obligation).
//
// The brief deliberately mixes both kinds: real requirement values with their
// basis, and two tuning values the author volunteered. An ADR that keeps the
// tuning values, or blurs the requirement values, is the failure.
import { skillText, PLUGIN_ROOT, TAIL_SPEC, expectLintClean } from "../lib/harness.mjs";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { createWorkspace } from "../regression/workspace.mjs";
import { authoringEvidenceChecks } from "../lib/authoring-evidence.mjs";
import { responseObligations } from "../skills/response-contract.mjs";

const draftRoot = ".adr-review/author-candidate";

const BRIEF = `우리는 업로드 기능에 서명된 URL 방식을 도입하려고 한다.

배경: 지금은 파일이 API 서버를 거쳐 업로드돼 대용량 파일에서 서버 메모리가 튄다.
스토리지로 직접 올리게 하고 싶다.

고려한 방법:
- 서명된 URL로 클라이언트가 스토리지에 직접 업로드 (하고 싶은 방식)
- 지금처럼 API 서버가 프록시 (구현은 단순하지만 메모리 문제가 그대로)
- 별도 업로드 전용 서버를 둠 (운영 부담이 커서 접었다)

결정을 가른 조건:
- 100MB 파일 업로드 시 API 서버 메모리가 튀지 않아야 한다
- 스토리지 자격증명이 클라이언트로 나가면 안 된다 (보안 정책)
- 인프라 팀이 2주 안에 지원 가능한 범위여야 한다

지켜야 하는 값들:
- 첨부파일은 최대 100MB (유료 플랜 계약)
- 서명된 URL은 발급 후 10분간만 유효 (보안 정책)
- 무료 플랜은 하루 20개까지 업로드 (가격 정책)
- 업로드 실패 시 사용자에게 재시도 가능 여부를 알려줘야 한다
- 파일은 업로드중·검증중·사용가능·삭제됨 중 하나의 상태를 가지며, 삭제됨에서 다른 상태로
  돌아가지 않는다

그리고 구현하면서 정한 것들:
- 서명 URL 생성 시 커넥션 풀은 10으로 뒀다
- 검증 워커는 4개로 돌린다
`;

const scenario = {
  name: "author-keeps-values-and-lints",
  agentTimeoutMs: 600_000, // reads the seeded rule documents, drafts and lints before its report
  description:
    "/adr-new must produce an ADR that passes the shipped structure lint, keeps requirement values verbatim, and leaves tuning values out.",
  bugReport: "“ADR을 써줬는데 커넥션 풀 크기까지 본문에 들어갔다 / 100MB가 '대용량'으로 뭉개졌다”",
  draftRoot,

  build(dir) {
    createWorkspace(
      dir,
      { "docs/adr/.mapping.json": JSON.stringify({ categories: {} }) + "\n" },
      PLUGIN_ROOT,
    );
    appendFileSync(path.join(dir, ".git/info/exclude"), "\n.adr-review/\n");

    return [
      skillText("adr-new", {
        references: [
          "skills/adr-new/references/draft-and-index.md",
          "skills/adr-new/references/candidate-verification.md",
        ],
      }),
      `\n---\n\n# This run\n`,
      `You are executing /adr-new in the repository at ${dir}, with the argument: media/upload`,
      ``,
      `The rule documents are already seeded under docs/adr/, and docs/adr/.mapping.json`,
      `exists as an empty skeleton — so skip the seeding and staleness parts of step 1.`,
      ``,
      `This is a NON-INTERACTIVE run: you cannot ask the user anything. The user has`,
      `already supplied everything below, so treat step 2 as answered, and treat the`,
      `step 7 confirmation as granted — apply the verified candidate instead of asking.`,
      `This waives only the interactive confirmation, not the draft-first verification.`,
      `An independent, Git-ignored draft workspace is available at ${draftRoot}. The fixture tools`,
      `can prepare its copied docs and check its structure with draft=true.`,
      `Do not invent any value that is not stated below.`,
      ``,
      `## The user's brief`,
      ``,
      BRIEF,
      ``,
      `## What to produce`,
      ``,
      `- the ADR file under docs/adr/media/upload/`,
      `- the docs/adr/.mapping.json entry for the media/upload category`,
      `First prepare and verify the independent candidate under step 6(a), fixing`,
      `candidate errors there. Then apply the verified contents to the approved final`,
      `paths and check the resulting official structure. Do not write a final file`,
      `and use a later successful check as a substitute for candidate validation.`,
      TAIL_SPEC,
    ].join("\n");
  },
};

export default scenario;

// Retain the original artifact obligation and add explicit value and process coverage.
export const obligations = [
  ...responseObligations(scenario),
  {
    id: "candidate-before-apply",
    text: "Prepare an independent copy of the original documents, write and validate the candidate there before any official ADR or mapping write, and apply only the validated content under the given approval. Revalidate after candidate changes and check official structure after apply. A final lint pass, the evaluator's own check or pre-granted approval does not prove candidate validation occurred. Preserve required values, states and other contracts; do not invent missing policies or claim an unperformed check.",
  },
  {
    id: "values",
    text: "The written ADR keeps the brief's requirement values verbatim: attachments of at most 100MB, signed URLs valid for 10 minutes after issue, at most 20 uploads per day on the free plan, and the file state set including deleted. It leaves the connection pool size of 10 and the four verification workers out of the ADR as implementation tuning, and writes values as prose rather than code constants.",
  },
];

export function mechanicalScore(input) {
  return [
    ...authorArtifactChecks(input),
    ...authoringEvidenceChecks(input.events, { draftRoot, category: "media/upload" }),
    expectLintClean(input.dir),
  ];
}
