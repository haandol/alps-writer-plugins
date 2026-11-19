import { seedMapping, write } from "../lib/harness.mjs";
import { buildPrompt, REPORT_REFERENCES } from "../lib/ontology-fixtures.mjs";

const NOTES = `# 반품 업무 메모 (고객지원팀)

고객이 반품을 접수한다.
고객지원 담당자가 반품 사유를 확인하고 승인한다.
반품 접수 다음 날 재고 수량이 다시 늘어난다.
`;
const ANSWERS = `{"questions":[
 {"id":"Q1","text":"반품 승인은 고객지원 담당자가 하나요?","answer":{"optionId":"yes","optionLabel":"예","channel":"web"},"pending":false},
 {"id":"Q2","text":"반품 승인 뒤 환불은 누가 하나요?","answer":{"optionId":null,"text":"재무팀이 환불한다","channel":"web"},"pending":false},
 {"id":"Q3","text":"반품 상품 회수는 택배사가 하나요, 고객이 보내나요?","answer":null,"pending":false}
],"closed":true}`;

export default {
  name: "ontology-build-reports-partial-results",
  description:
    "When part of the reading fails and the session ends with a question unanswered, the report separates completed and remaining scope, keeps the unanswered path open and unsaved, and does not present a partial event map as the whole system.",
  obligations: [
    {
      id: "completed-and-remaining",
      text: "The response reports the completed scope and the remaining scope separately — including docs/returns/pickup-guide.hwp, which could not be read in this environment — and does not report the build as a complete success.",
    },
    {
      id: "unanswered-open",
      text: "Q3 (who brings the returned item back) was not answered: its candidate is not saved; it stays a question of the report and is recorded as an open path of the return process (or proposed as one) rather than dropped.",
    },
    {
      id: "partial-map",
      text: "The event map is presented as covering only the materials read, not as the complete returns system, and the stock increase the day after a return is received is not shown as a confirmed causal consequence of the return, since no document states that cause.",
    },
  ],
  build(dir) {
    seedMapping(dir);
    write(dir, "docs/returns/notes.md", NOTES);
    return buildPrompt(
      [...REPORT_REFERENCES, "skills/ontology-build/references/save.md"],
      "This project has no saved ontology and no ADR documents. The user asked for a first model of returns from docs/returns.",
      "- docs/returns/notes.md:\n```markdown\n" + NOTES + "```",
      "- docs/returns/pickup-guide.hwp: no reader for this format is available here; its text could not be extracted.",
      "You presented the report and opened the web question session. The user has now ended the session. `ontology-ask.mjs answers <run>` printed:",
      "```json\n" + ANSWERS + "\n```",
      "Do not call tools or write files. Show the report update you present now and what you propose to save.",
    );
  },
};
