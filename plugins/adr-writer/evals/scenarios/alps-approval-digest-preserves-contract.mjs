import {
  alpsGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";
import { semanticScore } from "../lib/semantic-score.mjs";

const SOURCE = `
Section 7 Feature: 팀 작업 세션

사용자는 팀 작업 세션을 만들고 승인된 결과를 보관한다.
- 한 세션은 최대 20턴이다 (요금 정책).
- 승인되지 않은 세션은 30일 뒤 삭제한다 (보관 비용 정책).
- 워크스페이스 owner만 결과를 외부로 내보낼 수 있다 (권한 정책).
- 상태는 draft, approved, archived이며 archived는 draft로 돌아갈 수 없다.
- Demo checkpoint: 승인 후 팀 대시보드에 결과가 표시된다.

구현 메모에는 PostgreSQL, Redis, 3회 재시도가 적혀 있지만 이는 요구사항이 아니다.
`;

export const obligations = [
  {
    id: "limit",
    text: "The visible digest preserves a maximum of 20 turns per session, not a minimum or an unlimited session.",
  },
  {
    id: "retention",
    text: "The visible digest says unapproved sessions are deleted after 30 days. Do not reverse the approved/unapproved condition or invent a different retention rule.",
  },
  {
    id: "permission",
    text: "The visible digest permits only the workspace owner to export results; a mention of owner without exclusivity or an added non-owner permission is insufficient.",
  },
  {
    id: "states",
    text: "The visible digest preserves exactly draft, approved, archived, and prohibits archived returning to draft. Listing states without the prohibition is insufficient.",
  },
  {
    id: "demo",
    text: "The visible digest says the result appears in the team dashboard after approval.",
  },
  {
    id: "options",
    text: "The visible digest explicitly offers all three choices: approve, revise, and defer. A choice only in the machine tail is insufficient.",
  },
  {
    id: "tail",
    text: "The CONTRACT_ITEM tail repeats all five product contracts (turn cap, retention condition, export permission, states and forbidden transition, dashboard result after approval) consistently with the visible digest. Correct text in one cannot excuse reversed or missing contracts in the other.",
  },
  {
    id: "save",
    text: "The tail states both that no requirement absent from the digest may be saved and that each complete Section 7.x Feature remains a separate save unit.",
  },
  {
    id: "presentation",
    text: "The visible digest excludes PostgreSQL, Redis and the non-required three-retry implementation note and is readable raw text without Markdown tables.",
  },
].map((item) => ({ ...item, label: `approval digest: ${item.id}` }));

export default {
  name: "alps-approval-digest-preserves-contract",
  description:
    "ALPS approval must show a concise raw-text digest while preserving every contract value, permission, state rule, and demo outcome and excluding implementation detail.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      alpsGuideText(7),
      `\n---\n\n# This run`,
      SOURCE,
      `Produce the user-facing approval digest only; do not call tools or print the full Feature.`,
      `Keep it readable as raw text and end with approve, revise, and defer choices.`,
      `In the tail use CONTRACT_ITEM for each preserved contract, RESPONSE_OPTIONS once,`,
      `NO_UNSEEN_CONTRACT once, and SEPARATE_SAVE_UNIT once.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ output, cmd, invoke }) {
    const visible = output.split(/---\s*\n\s*## Machine-readable tail|===\s*EVAL-VERDICT/i)[0];
    return semanticScore({
      obligations,
      sources: { visible, tail: output.slice(visible.length) },
      cmd,
      invoke,
    });
  },
};
