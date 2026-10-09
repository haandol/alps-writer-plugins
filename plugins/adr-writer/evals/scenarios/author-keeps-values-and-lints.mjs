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
//      one level down (the constant name, the pool size) do not appear.
//
// The brief deliberately mixes both kinds: real requirement values with their
// basis, and two tuning values the author volunteered. An ADR that keeps the
// tuning values, or blurs the requirement values, is the failure.
import {
  skillText,
  PLUGIN_ROOT,
  read,
  TAIL_SPEC,
  expectLintClean,
  expectText,
  expectNoText,
} from "../lib/harness.mjs";
import { appendFileSync, readdirSync, readFileSync, statSync } from "node:fs";
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

  score({ dir }) {
    // Find whatever ADR got written, wherever it landed.
    const body =
      read(dir, "docs/adr/media/upload/0001-signed-url-upload.md") ?? findFirstAdr(dir) ?? "";
    const mapping = read(dir, "docs/adr/.mapping.json") ?? "";

    return [
      { ...fileWritten(body), label: "an ADR file was written" },
      // Only meaningful once something exists: the lint reports a repo with no
      // ADRs as clean (nothing to lint), so running it against an empty fixture
      // would score a green on a run that produced nothing at all.
      body.trim()
        ? expectLintClean(dir)
        : {
            pass: false,
            detail: "skipped — no ADR was written, so there was nothing to lint",
            label: "structure-lint reports no error",
          },
      // Requirement values, verbatim. These are the whole reason the ADR exists.
      expectText(body, /100\s*MB/i, "keeps the 100MB attachment cap"),
      expectText(body, /10\s*분|10 minutes/i, "keeps the 10-minute URL validity"),
      expectText(body, /20\s*개|20 uploads|하루 20|20 per day/i, "keeps the 20-per-day free limit"),
      // The non-numeric contract is the half most often dropped as "obvious".
      expectText(body, /삭제됨|deleted/i, "keeps the file state set"),
      // Tuning values belong to the code level and must not be pulled up.
      expectNoText(
        body,
        /커넥션 풀|connection pool|풀은 10|pool size/i,
        "omits the connection pool size",
      ),
      expectNoText(body, /워커\s*4|4 workers|워커는 4/i, "omits the worker count"),
      // A value written as a constant is the format half of R18 — the harness
      // warns on it, but check directly since the warning is not an error.
      expectNoText(body, /[A-Z_]{4,}\s*=\s*\d/, "writes values as prose, not as code constants"),
      // The mapping is part of the deliverable, not an afterthought.
      expectText(mapping, /media\/upload/, "registers the category in .mapping.json"),
      expectText(mapping, /"status":\s*"Proposed"/, "records the new ADR as Proposed"),
    ];
  },
};

export default scenario;

// Retain the original artifact obligation and add explicit process coverage.
// The legacy scorer remains artifact-only; unified DeepEval also checks actions.
export const obligations = [
  ...responseObligations(scenario),
  {
    id: "candidate-before-apply",
    text: "Prepare an independent copy of the original documents, write and validate the candidate there before any official ADR or mapping write, and apply only the validated content under the given approval. Revalidate after candidate changes and check official structure after apply. A final lint pass, the evaluator's own check or pre-granted approval does not prove candidate validation occurred. Preserve required values, states and other contracts; do not invent missing policies or claim an unperformed check.",
  },
];

export function deterministicScore(input) {
  return [
    ...scenario.score(input),
    ...authoringEvidenceChecks(input.events, { draftRoot, category: "media/upload" }),
  ];
}

function fileWritten(body) {
  return {
    pass: Boolean(body && body.trim()),
    detail: body ? `${body.length} chars` : "no ADR found on disk",
  };
}

// Fall back to any NNNN-*.md under docs/adr/ — the agent may have chosen a
// different (still canonical) filename, which is its prerogative.
function findFirstAdr(dir) {
  const stack = [path.join(dir, "docs", "adr")];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(cur, e);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (/^\d{4}-.*\.md$/.test(e)) return readFileSync(full, "utf8");
    }
  }
  return null;
}
