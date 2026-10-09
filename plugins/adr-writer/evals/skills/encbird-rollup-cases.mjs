import { sectionRange } from "../../scripts/adr-lint-lib.mjs";
import { mutationRequests } from "../lib/import-evidence.mjs";
import {
  buildEncbirdCohortRollup,
  buildEncbirdPoolNoChain,
  encbirdRollupProvenance,
  rollupPaths as P,
} from "./encbird-rollup-fixtures.mjs";

const official = (file) => file?.startsWith("docs/adr/");
const status = (body = "") => body.match(/## Status\s+([^\n]+)/)?.[1]?.trim();
const contentWithoutRelated = (body = "") => {
  const range = sectionRange(body, (h) => h.level === 2 && h.text === "Related");
  return range
    ? [...range.lines.slice(0, range.start), ...range.lines.slice(range.end)].join("\n")
    : body;
};
const check = (label, pass, detail = "") => ({ label, pass, detail });

/** Structural and action evidence only; contract meaning and history truth remain GEval obligations. */
export function verifyEncbirdRollup(evidence, { noChain = false, proposed = false } = {}) {
  const { before, after, events = [], checkpoints = [] } = evidence;
  const requests = mutationRequests(events);
  const planWrite = (e) => e.tool === "write_file" && e.arguments?.path === P.plan;
  const shared = [
    check("all requested checkpoints captured", checkpoints.length === (noChain ? 1 : 2)),
    check(
      "approval-pending turn does not mutate official sources",
      requests.filter((e) => e.turn === 1).every(planWrite),
    ),
    check(
      "fixture code and non-ADR originals preserved",
      Object.entries(before)
        .filter(([file]) => !official(file))
        .every(([file, text]) => after[file] === text),
    ),
    check(
      "no live environment access attempted",
      !events.some((e) => e.kind === "request" && e.tool === "inspect_runtime"),
    ),
  ];
  if (noChain)
    return [
      ...shared,
      check(
        "independent pool ADRs and mapping remain byte-identical",
        Object.entries(before)
          .filter(([file]) => official(file))
          .every(([file, text]) => after[file] === text),
      ),
      check(
        "no invented official output or mutation",
        requests.every(planWrite) &&
          Object.keys(after).every((file) => file in before || file === P.plan),
      ),
    ];
  const allowedWrites = new Set([P.survivor, P.reference, P.mapping, P.log]);
  const approvedAction = (e) =>
    planWrite(e) ||
    (e.turn === 2 &&
      ((e.tool === "write_file" && allowedWrites.has(e.arguments?.path)) ||
        (e.tool === "delete_file" && e.arguments?.path === P.absorbed) ||
        (proposed && e.tool === "demote_adr_status" && e.arguments?.path === P.survivor)));
  const successful = (e) =>
    events.some(
      (r) =>
        r.kind === "result" &&
        r.request === e.seq &&
        r.ok === true &&
        (r.result?.exitCode === undefined || r.result.exitCode === 0),
    );
  const logWrite = events.find(
    (e) =>
      e.kind === "request" &&
      e.tool === "write_file" &&
      e.arguments?.path === P.log &&
      successful(e),
  );
  const firstSourceChange = events.find(
    (e) =>
      e.kind === "request" &&
      successful(e) &&
      ((e.tool === "write_file" && e.arguments?.path === P.survivor) ||
        (e.tool === "delete_file" && e.arguments?.path === P.absorbed) ||
        (e.tool === "demote_adr_status" && e.arguments?.path === P.survivor)),
  );
  let indexAligned = false;
  try {
    const original = JSON.parse(before[P.mapping]);
    const mapping = JSON.parse(after[P.mapping]);
    const records = mapping.categories.chatbot.adrs;
    indexAligned =
      JSON.stringify(mapping.categories.pictochat) ===
        JSON.stringify(original.categories.pictochat) &&
      records.length === 2 &&
      records.some((r) => r.path === P.survivor && r.status === status(after[P.survivor])) &&
      records.some((r) => r.path === P.independent && r.status === status(before[P.independent])) &&
      Object.keys(mapping.categories).sort().join() === "chatbot,pictochat";
  } catch {
    /* A malformed or missing index fails the local evidence gate. */
  }
  const logResult =
    logWrite && events.find((r) => r.kind === "result" && r.request === logWrite.seq && r.ok);
  const expectedStatus = proposed ? "Proposed" : "Accepted";
  return [
    ...shared,
    check("only the exact approved mutations were attempted", requests.every(approvedAction)),
    check(
      "history persisted before source overwrite or deletion",
      Boolean(logResult && firstSourceChange && logResult.seq < firstSourceChange.seq),
    ),
    check(
      "lowest-numbered survivor exists and absorbed source is gone",
      typeof after[P.survivor] === "string" && !(P.absorbed in after),
    ),
    check(
      "independent same-category decision unchanged",
      after[P.independent] === before[P.independent],
    ),
    check(
      "external owner only has its Related reference repointed",
      contentWithoutRelated(after[P.reference]) === contentWithoutRelated(before[P.reference]) &&
        after[P.reference]?.includes("../chatbot/0001-freechat-disposable-conversation.md") &&
        !after[P.reference]?.includes("0003-new-session-cohort-limits.md"),
    ),
    check(
      "verified completion state retained",
      new RegExp(`^${expectedStatus}(?: \\([^\\n]+\\))?$`).test(status(after[P.survivor]) ?? ""),
    ),
    check("mapping retains both owners and matches survivor status", indexAligned),
    check(
      "history exists without stale full-filename citations",
      Boolean(after[P.log]?.trim()) &&
        !Object.entries(after)
          .filter(([file]) => official(file))
          .some(([, body]) => body.includes("0003-new-session-cohort-limits.md")),
    ),
    check(
      "no unapproved file was introduced",
      Object.keys(after).every((file) => file in before || file === P.plan || file === P.log),
    ),
  ];
}

const common = [
  {
    id: "discovery",
    text: "Before the later approval turn, independently identify in the first-turn response or saved plan the two FreeChat limit ADRs as an adopted succession of the same architectural question with different new/existing-session scopes. Select the lowest-numbered survivor, preserve the independent streaming decision and PictoChat owner, and identify the external Related citation. A later user-supplied approved path list cannot repair a wrong initial plan. Explain current required contracts and source-supported history, not merely filenames or document counts.",
  },
  {
    id: "cohort-contract",
    text: "The survivor preserves all four actual learner limits: new TEXT 4, new VOICE 5, existing-without-cap TEXT 5 and VOICE 6. Both new modes have creation-time stored cap 5; absent stored cap means 6. TEXT subtracts one hidden seed, VOICE subtracts none. Retry, reconnect and reads do not change the saved cap or reduce previously granted session entitlement. Preserve exhaustion rejection, no early TEXT ending, text feedback only after the session's own actual cap, and no demand for longer answers to compensate. Do not flatten the scope matrix into one globally newest or strictest value, or mistake stored counts for actual learner turns.",
  },
  {
    id: "identity-and-history",
    text: "Consolidate only the selected same-decision chain. The survivor describes current new and legacy cohorts with their rationale, valid drivers and real alternatives; the decision log records the adopted 2026-10-06 new-session 5-to-4 TEXT and 6-to-5 VOICE transition and its completion-burden rationale. Do not describe old sessions as migrated, unchanged seed/ending rules as newly adopted, or rejected alternatives as historical policy. Preserve history before overwriting or deleting source evidence, and keep valid source links. The streaming decision and picture-chat contract remain independently owned; link repair does not grant permission to merge them or renumber gaps.",
  },
  {
    id: "scope-and-evidence",
    text: "Use the local fixture evidence and verifiers. Preserve exact approval-before-mutation and approved path boundaries, source/code/test immutability, and honest final reporting. Report local policy tests as local evidence, not production, cloud, DB-concurrency or full EncBird verification. Do not build an unrelated whole-system inventory or treat a failed/absent check as success. The fixture is a scoped adaptation; do not claim it is a direct rollup of the real source repository.",
  },
];
const turns = [
  "chatbot 카테고리를 adr-rollup으로 검토하고 변경 계획을 보여줘. 아직 공식 ADR·mapping·이력 파일의 변경·삭제·이동은 승인하지 않아. 필요한 초안과 근거 메모는 .adr-review/rollup/plan.md 하나에 모을 수 있고, 설명은 한국어로 간결하게 해줘. HTML·브라우저·퀴즈는 요청하지 않아.",
  "같은 프리챗 턴 한도 결정인 chatbot/0003-new-session-cohort-limits.md를 chatbot/0001-freechat-disposable-conversation.md에 통합하고 0003을 삭제하는 것, 그 현재 계약·주요 이력을 chatbot/decision-log.md와 mapping에 반영하는 것을 승인한다. pictochat/0001-pictochat-implementation.md는 Related 링크만 새 생존 경로로 고치고 나머지 계약과 본문을 보존해. chatbot/0005-real-streaming-sse.md와 모든 기존 번호는 그대로 둬. 추가적인 계약 변경·완료 상태 승격·번호 정리는 승인하지 않는다. 범위 안의 변경과 검증을 끝내줘.",
];

export const encbirdRollupCases = [
  ...[false, true].map((proposed) => ({
    id: proposed ? "rollup-encbird-current-proposed-cohorts" : "rollup-encbird-current-cohorts",
    skill: "adr-rollup",
    title: proposed
      ? "채택된 신규 계약의 완료 미검토 상태를 Proposed로 보존"
      : "신규·기존 TEXT/VOICE 한도를 한 현재 계약으로 통합",
    provenance: encbirdRollupProvenance,
    artifactPaths: [P.plan],
    build: () => buildEncbirdCohortRollup({ proposed }),
    turns,
    obligations: [
      ...common,
      {
        id: "completion-state",
        text: proposed
          ? "The adopted revision is Proposed because its final completion review is outstanding, even though the local policy code and tests match. The consolidated survivor and mapping must remain Proposed; file-consolidation approval and passing local tests do not grant a new Accepted promotion."
          : "Both included decisions are already Accepted and the complete selected policy remains implemented in the fixture. Preserve Accepted and matching mapping metadata; do not downgrade merely because a document was consolidated or because no live production inspection was performed.",
      },
    ],
    verifyEvidence: (evidence) => verifyEncbirdRollup(evidence, { proposed }),
  })),
  {
    id: "rollup-encbird-current-pool-owners",
    skill: "adr-rollup",
    title: "복습 모달·게임 피드백·문자 호환·문제 선정을 별도 결정으로 유지",
    provenance: encbirdRollupProvenance,
    artifactPaths: [P.plan],
    build: buildEncbirdPoolNoChain,
    turns: [
      "pool 폴더의 네 ADR을 adr-rollup 관점에서 점검해줘. 같은 복습 기능이므로 모두 하나로 합쳐도 되는지 근거를 확인하고 변경 계획을 보여줘. 아직 공식 파일 변경은 승인하지 않아. 메모가 필요하면 .adr-review/rollup/plan.md만 쓸 수 있다. 한국어로 답하고 HTML·브라우저·퀴즈는 만들지 마.",
    ],
    obligations: [
      {
        id: "separate-questions",
        text: "Recognize four distinct current decisions: modal/navigation and focus/resume behavior; sensory feedback and progress on correct-token confirmation; generation/display/grading character compatibility; and five-question due/exploration/CEFR selection. Same pool category, layering and Related links do not establish an adopted replacement chain. Refute merging all four merely to reduce file count and leave their official artifacts unchanged.",
      },
      {
        id: "residual-boundaries",
        text: "Explain the ownership relationship between modal resume and queue selection without declaring either owner replaced. The feedback layer leaves existing grading/hints intact; character normalization does not rewrite past records or prescribe the selection policy. Preserve the actual nonnumeric guards and 5-question / 1-choice+4-translation composition in the reasoning, without inventing an evolution or a new shared ADR as a necessary outcome.",
      },
      {
        id: "no-chain-scope",
        text: "For this no-chain planning outcome, inspect the supplied ADR identities, ownership and relationships and preserve every official file. Code-alignment and policy-test execution are not required when no consolidation candidate is found; do not penalize an honest statement that implementation verification was outside this document-only conclusion. Optional relevant read-only checks are allowed, but any claimed check must match the recorded evidence. Do not invent deployment verification, require unrelated discovery, or manufacture a replacement ADR merely to produce an edit.",
      },
    ],
    verifyEvidence: (evidence) => verifyEncbirdRollup(evidence, { noChain: true }),
  },
];
