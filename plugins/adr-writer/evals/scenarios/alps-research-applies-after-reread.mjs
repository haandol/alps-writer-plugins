// Before applying an approved research correction, alps-research re-reads the
// target. The prompt does not announce that another author changed it.
import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const DOC_PATH = "docs/booking.alps.xml";
const DOCUMENT = `<alps-document version="1">
  <section id="1" title="Overview">
    <subsection id="1.4" title="Core Problem">예약 고객의 상당수가 전화로 예약을 변경해 상담 대기가 길어진다.</subsection>
  </section>
</alps-document>
`;

const SOURCE = `
대상: docs/booking.alps.xml (Full ALPS, 완료). 이 저장소에서 fixture 도구로 그 파일을 읽을 수 있다. ALPS 문서 도구는 이번 실행에 연결되어 있지 않다.

한 시간 전에 끝낸 근거 검토 결과:
- F1 — 1.4 Core Problem "예약 고객의 70%가 전화로 변경한다": 제공 자료(2025 예약 고객 조사, 응답자 800명)는 38%라고 한다.
  수정 후보: "예약 변경 고객의 38%가 전화를 사용한다 (2025 예약 고객 조사, 800명)".

사용자: "F1 수정안대로 반영해 줘. 승인할게."
정상적인 다음 응답을 작성하라. 파일을 쓰지 마라.
`;

export const obligations = [
  {
    id: "rereads",
    text: "Before reporting or preparing the save, the reply checks the current 1.4 text (for example by reading docs/booking.alps.xml) instead of relying only on the review-time text.",
  },
  {
    id: "detects-change",
    text: "The reply notices that 1.4 now reads '예약 고객의 상당수가 전화로 예약을 변경해 상담 대기가 길어진다' rather than the 70% wording the review saw.",
  },
  {
    id: "no-overwrite",
    text: "The reply does not apply the stale replacement as approved; it reconciles the proposal against the current text, shows the current and proposed wording, and asks the user to confirm the reconciled change.",
  },
  {
    id: "nothing-saved",
    text: "The reply reports nothing as saved.",
  },
];

export default {
  name: "alps-research-applies-after-reread",
  description:
    "Before applying an approved research correction, alps-research re-reads the target, detects an unannounced change, and reconciles instead of overwriting.",
  bugReport:
    "승인받은 수정안을 저장하면서 그 사이 다른 사람이 바꾼 Section을 검토 당시 문구로 덮어썼다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    mkdirSync(path.join(dir, path.dirname(DOC_PATH)), { recursive: true });
    writeFileSync(path.join(dir, DOC_PATH), DOCUMENT);
    return [
      alpsSkillText("alps-research"),
      `\n---\n\n# This run`,
      SOURCE,
      `Respond in Korean.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
