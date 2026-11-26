// /adr-new must settle an externally checkable assumption at its authoritative
// source before asking, must not record a contradicted assumption or a
// snippet-only claim as fact, must cite the deciding source under Related, and
// must not persist research notes.
//
// The fixture carries a vendored copy of the provider's service terms and a
// saved search-results page holding only snippets. The brief assumes that a
// batch finishes within an hour, while the terms promise completion only within
// 24 hours; the daily 02:00 → 09:00 window is a contract, so the adopted Batch
// API choice depends on that assumption. A retention claim appears only in a
// snippet whose page was never opened, and an organizational policy against
// adding provider contracts has no source at all: both must stay questions. The
// user recalls no alternative, so any proposed alternative needs a real basis
// and remains a candidate until the user confirms it.
import { appendFileSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PLUGIN_ROOT, read, skillText, TAIL_SPEC } from "../lib/harness.mjs";
import { createWorkspace } from "../regression/workspace.mjs";
import { STAMPED_RULE_DOCS } from "../../scripts/adr-lint-lib.mjs";

const draftRoot = ".adr-review/author-candidate";
const MAPPING = JSON.stringify({ categories: {} }) + "\n";
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
const SNIPPETS_PATH = "vendor/search/acme-retention-results.md";
const SNIPPETS = `# Saved web search results (snippets only; no result page was opened)

Query: "Acme AI batch output retention"

1. acme-ai.example/blog/batch-tips — "...batch outputs are deleted automatically after 30 days..."
2. forum.example/t/acme-retention — "I think they keep results for a month, not sure..."
`;

const BRIEF = `상담 기록 요약 기능의 처리 방식을 ADR로 남기고 싶다.

- 매일 02:00에 전날 상담 기록을 요약한다. 하루 기록은 최대 약 20,000건이다.
- 상담원은 09:00 업무 시작 전에 요약을 받아야 한다 (운영 계약).
- 비용을 줄이려고 Acme AI의 Batch API를 쓰려고 한다.
- 배치는 1시간 안에 끝나는 것으로 알고 있다. 이 가정이 틀리면 방식을 다시 봐야 한다.
- Acme는 배치 결과를 30일 뒤 자동 삭제한다고 검색에서 봤다. 상담 기록 원문이 외부에 오래 남으면 안 된다는 보안 정책 때문에 중요하다.
- 조직 정책상 새 AI provider 계약은 추가하지 않는다고 들었는데 확실하지 않다.
- 다른 방법은 딱히 생각나지 않는다.

저장소의 ${TERMS_PATH}에는 Acme AI 서비스 약관의 사본이 있고, ${SNIPPETS_PATH}에는 저장해 둔 검색 결과가 있다.
`;

export const obligations = [
  {
    id: "checks-source-first",
    text: "The reply shows that it checked the vendored Acme AI service terms and reports what they establish: Acme guarantees batch completion only within 24 hours with no shorter guarantee, and the 50,000-request batch limit covers about 20,000 daily records. It does not ask the user to confirm the batch completion time or the batch size limit, which that source already settles.",
  },
  {
    id: "contradicted-not-fact",
    text: "The one-hour completion assumption is identified as contradicted by the source. Neither the reply nor the draft candidate presents batch completion before 09:00 as guaranteed or records one-hour completion as a fact or as the basis of an approved decision; the Batch API choice is presented as needing reconsideration against the 09:00 obligation or a user decision.",
  },
  {
    id: "snippet-not-confirmation",
    text: "The 30-day deletion claim, which rests only on unopened search snippets, is not recorded as fact in the reply or the draft candidate. The reply says the snippets do not confirm it and keeps it an open question tied to the security policy.",
  },
  {
    id: "asks-unsettled-only",
    text: "The reply asks the user about the organizational policy on adding an AI provider contract and about the unconfirmed output retention, saying why no available source settles each. It does not treat either as confirmed or refuted.",
  },
  {
    id: "grounded-candidate-alternative",
    text: "The reply proposes at least one realistic alternative that exists in the checked source, such as the Acme realtime API with its 500 requests-per-minute limit as the basis for fitting about 20,000 records into the window, and presents it as a candidate awaiting the user's confirmation. The draft candidate does not list it as an alternative the user already considered.",
  },
  {
    id: "related-citation",
    text: "The draft candidate's Related section cites the vendored Acme AI service terms as the source of the fact that decides the alternative.",
  },
  {
    id: "holds-approval",
    text: "The ADR revision is not reported as approved or saved: docs/adr/ and docs/adr/.mapping.json stay unchanged, the candidate stays in the draft workspace, and the reply lists the questions it waits for.",
  },
];

export default {
  name: "author-verifies-external-premise",
  agentTimeoutMs: 600_000, // reads the rule documents and the vendored terms, then a full digest
  description:
    "/adr-new must check an externally verifiable decision assumption at its authoritative source before asking, show and cite the source, keep a contradicted or snippet-only assumption out of the facts, ask only what no source settles, keep a proposed alternative unconfirmed, and persist no research notes.",
  bugReport:
    "“provider가 보장하지 않는 처리 시간을 가정으로 ADR을 승인했고, 구현하면서야 약관과 다르다는 걸 알았다”",
  draftRoot,

  build(dir) {
    createWorkspace(dir, { "docs/adr/.mapping.json": MAPPING }, PLUGIN_ROOT);
    appendFileSync(path.join(dir, ".git/info/exclude"), "\n.adr-review/\n");
    for (const [file, text] of [
      [TERMS_PATH, TERMS],
      [SNIPPETS_PATH, SNIPPETS],
    ]) {
      mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
      writeFileSync(path.join(dir, file), text);
    }
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
      `This is a NON-INTERACTIVE run: you cannot ask the user anything mid-way. Treat`,
      `step 2 as answered by the brief below, and treat the step 7 confirmation as`,
      `granted for what the brief and the sources settle; it does not approve anything`,
      `they leave open. An independent, Git-ignored draft workspace is available at`,
      `${draftRoot}. The fixture tools can prepare its copied docs and check its`,
      `structure with draft=true. Prepare and verify the candidate there.`,
      `Because you cannot ask, state every question you would ask at step 7 in your`,
      `report, with what each one holds back, and report what you applied, if anything.`,
      ``,
      `## The user's brief`,
      ``,
      BRIEF,
      TAIL_SPEC,
    ].join("\n");
  },

  /** File state is exact; whether the sources were used is judged semantically. */
  mechanicalScore({ dir }) {
    const live = listFiles(path.join(dir, "docs", "adr")).filter(
      (file) => file !== ".mapping.json" && !STAMPED_RULE_DOCS.includes(file),
    );
    const draft = listFiles(path.join(dir, draftRoot));
    const candidates = draft.filter((file) => /^docs\/adr\/.*\d{4}-[^/]*\.md$/.test(file));
    const extra = draft.filter(
      (file) =>
        !(
          file.startsWith("docs/adr/") &&
          (/\d{4}-[^/]*\.md$/.test(file) ||
            file === "docs/adr/.mapping.json" ||
            STAMPED_RULE_DOCS.includes(file.slice("docs/adr/".length)))
        ),
    );
    return [
      {
        pass: live.length === 0 && read(dir, "docs/adr/.mapping.json") === MAPPING,
        detail: live.length ? `written: ${live.join(", ")}` : "docs/adr/ holds only the seed",
        label: "leaves docs/adr/ and its mapping unchanged while questions remain",
      },
      {
        pass: candidates.length > 0,
        detail: candidates.join(", ") || `no ADR candidate under ${draftRoot}/docs/adr/`,
        label: "prepares the ADR candidate in the draft workspace",
      },
      {
        pass: extra.length === 0,
        detail: extra.length
          ? `extra files: ${extra.join(", ")}`
          : "only the candidate and copied docs",
        label: "persists no research notes beside the candidate",
      },
    ];
  },
};

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
