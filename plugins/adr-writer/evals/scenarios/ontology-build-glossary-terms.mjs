import { seedMapping, write } from "../lib/harness.mjs";
import { buildPrompt, REPORT_REFERENCES } from "../lib/ontology-fixtures.mjs";

const GLOSSARY = `# Glossary

| Term | Meaning |
| --- | --- |
| 백오더 | 재고가 들어올 때까지 출고를 미뤄 둔 주문 라인. 결제는 출고 때 한다. |
`;
const DOC = `# 예약 판매 (상품팀, 2026-10)

백오더는 고객이 재고가 없는 상품을 미리 결제해 두는 주문이다.
재고가 들어오면 백오더 주문을 출고한다.
`;

export default {
  name: "ontology-build-glossary-terms",
  description:
    "A candidate term the ADR glossary already defines is shown with that definition and a differing meaning becomes a question; if the user declines the glossary cleanup, that concept and its relations are not saved and are reported as remaining.",
  obligations: [
    {
      id: "definition-shown",
      text: "The report shows the 백오더 candidate together with the definition docs/adr/glossary.md already gives (an order line whose shipping waits for stock, paid at shipping).",
    },
    {
      id: "different-meaning-question",
      text: "Because the document's meaning (an order the customer pays in advance for an out-of-stock product) differs from the glossary's, the report asks a question about it instead of choosing one meaning.",
    },
    {
      id: "declined-cleanup",
      text: "After the user declines the glossary cleanup, the 백오더 concept and the relations that use it are not saved; the response reports them as remaining scope, while the rest of the confirmed scope may still be saved.",
    },
    {
      id: "no-double-definition",
      text: "No saved result has the same term defined both in the model and in the glossary: the glossary is left untouched as the user asked, and the model does not define 백오더.",
    },
  ],
  build(dir) {
    seedMapping(dir);
    write(dir, "docs/adr/glossary.md", GLOSSARY);
    write(dir, "docs/product/preorder.md", DOC);
    return buildPrompt(
      [...REPORT_REFERENCES, "skills/ontology-build/references/save.md"],
      "This project has no saved ontology and no ADR documents; docs/adr/glossary.md exists. The user chose to build directly.",
      "사용자: /ontology-build docs/product/preorder.md",
      "docs/adr/glossary.md:\n```markdown\n" + GLOSSARY + "```",
      "docs/product/preorder.md:\n```markdown\n" + DOC + "```",
      "Do not call tools or write files. Answer in two parts.",
      "Part 1 — show the report entry for the 백오더 candidate and any question about it.",
      "Part 2 — later, the user answered the question with the document's meaning and confirmed the other candidates. At the approval summary `impact` listed a glossary cleanup for 백오더 in docs/adr/glossary.md, and the user replied: “용어집은 그대로 둘래. 나머지는 저장해 줘.” Show what you save and what you report then.",
    );
  },
};
