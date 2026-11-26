import {
  alpsGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

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
    id: "evidence-kinds",
    text: "Before approval, the visible digest says how each required contract (turn cap, retention, export permission, state rule) will be established: the kind of evidence, such as a code check or test, an eval, or user-flow or demo evidence, and its pass/fail rule. Listing the contracts without saying how each is checked is insufficient.",
  },
  {
    id: "options",
    text: "The visible digest explicitly offers all three choices: approve, revise, and defer. A choice only in the machine tail is insufficient.",
  },
  {
    id: "consistency",
    text: "Every statement of the five product contracts (turn cap, retention condition, export permission, states and forbidden transition, dashboard result after approval) anywhere in the reply is consistent; a correct statement in one place cannot excuse a reversed or missing contract elsewhere, including in optional machine-readable records.",
  },
  {
    id: "save",
    text: "The visible digest labels the complete Feature as its single approval and save unit, does not split its contracts across separate approvals, and neither saves it nor claims it was saved. Nothing in the reply indicates that a requirement absent from the digest would be saved.",
  },
  {
    id: "presentation",
    text: "The visible digest excludes PostgreSQL, Redis and the non-required three-retry implementation note and is readable raw text without Markdown tables.",
  },
];

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
      TAIL_SPEC,
    ].join("\n");
  },
};
