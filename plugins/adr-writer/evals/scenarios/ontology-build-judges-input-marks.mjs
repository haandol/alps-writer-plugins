import { seedMapping, write } from "../lib/harness.mjs";
import { buildPrompt, REPORT_REFERENCES } from "../lib/ontology-fixtures.mjs";

const WORKSHOP = `# 견적 워크숍 정리 (자동 요약, 2026-10-02)

- [확인됨] 영업 담당자가 견적을 제출하면 영업 관리자가 승인하거나 반려한다. (원 출처: 2026-09-12 영업 회의록 3행)
- [추론] 승인된 견적은 고객에게 자동으로 발송된다.
- [미확인] 반려된 견적은 영업 담당자가 고쳐서 다시 제출한다.
- [확인됨] 모든 견적은 영업 관리자의 승인을 받아야 한다.
`;
const POLICY = `# 견적 승인 기준 (영업정책, 2026-08)

할인율이 20%를 넘는 견적만 영업 관리자가 승인한다. 그 밖의 견적은 영업 담당자가 바로 발송한다.
`;

export default {
  name: "ontology-build-judges-input-marks",
  agentTimeoutMs: 600_000, // the whole candidates file is a long answer
  description:
    "Input marks keep their meaning: an inferred or unconfirmed claim is not stated, a confirmed mark is not the user's confirmation, an original source is the location, and disagreeing documents are a conflict.",
  obligations: [
    {
      id: "marks-kept",
      text: "The claim marked [추론] (approved quotes are sent automatically) is judged inferred and the claim marked [미확인] (a returned quote is fixed and resubmitted) is judged unconfirmed; neither is judged stated.",
    },
    {
      id: "original-source",
      text: "The candidate for the [확인됨] submission-and-approval claim gives its original source — the 2026-09-12 sales meeting notes, line 3 — as its source location, not only the workshop summary.",
    },
    {
      id: "conflict",
      text: "The approval requirement is judged conflicting: the workshop says every quote needs the sales manager's approval, the sales policy says only quotes with a discount above 20%. It becomes a question.",
    },
    {
      id: "location-or-marker",
      text: "Every model candidate element and relation — bounded contexts and their core logic included — shows its source document and location, or an explicit mark that no location was found; the four verdicts (stated, inferred, conflicting, unconfirmed) are distinguishable.",
    },
    {
      id: "not-confirmed",
      text: "The [확인됨] marks do not stand in for the user's confirmation: the response saves nothing and treats every candidate as still awaiting the user's confirmation (none is marked confirmed by the user).",
    },
    {
      id: "scope-stated",
      text: "The user gave no business scope, so the report states the scope it applied — the quote work the two documents cover.",
    },
  ],
  build(dir) {
    seedMapping(dir, { categories: {} });
    write(dir, "docs/sales/workshop-summary.md", WORKSHOP);
    write(dir, "docs/sales/quote-policy.md", POLICY);
    return buildPrompt(
      REPORT_REFERENCES,
      "This project has no saved ontology and no ADR documents.",
      "사용자: /ontology-build docs/sales",
      "docs/sales/workshop-summary.md:\n```markdown\n" + WORKSHOP + "```",
      "docs/sales/quote-policy.md:\n```markdown\n" + POLICY + "```",
      "Do not call tools or write files. Show the candidates.json you would write for the candidate tool (every candidate with its verdict, evidence and confirmed fields), then the report's applied scope and its questions. Also say what you would save at this point.",
    );
  },
};
