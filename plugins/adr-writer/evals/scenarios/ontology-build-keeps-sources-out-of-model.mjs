import { seedMapping, write } from "../lib/harness.mjs";
import { buildPrompt } from "../lib/ontology-fixtures.mjs";

const POLICY = `# 환불 정책 (고객지원팀, 2026-09 개정)

## 3. 환불 기한 (3쪽)

배송 완료 후 7일 안에 요청한 환불만 받는다. "배송 완료일로부터 7일이 지나면 환불을 받지 않는다."

## 4. 부분 환불 (4쪽)

묶음 상품은 개별 상품 단위로 환불한다.
`;

export default {
  name: "ontology-build-keeps-sources-out-of-model",
  description:
    "Rule candidates keep their sources in evidence: a saved basis is a kind and a short sentence, and a user-confirmed rule without a document is a user decision.",
  obligations: [
    {
      id: "basis",
      text: "The basis text of the refund-window rule (and the partial-refund rule) is a short business sentence. It may name the refund policy and one of its articles or clauses, but it contains no input file name or path (docs/policies/refund-policy.md), no page such as 3쪽 and no passage quoted from the document.",
    },
    {
      id: "evidence",
      text: "The input file's name, path and page appear only in report-only fields — the candidates' evidence entries or notHeld sources — and never in an attribute that would be saved into the model, such as basis, definition, label or comment.",
    },
    {
      id: "user-decision",
      text: "The rule the user stated in the conversation — a support lead approves every refund, with no document behind it — is a candidate whose basis kind is user-decision, not a document-backed kind.",
    },
    {
      id: "log",
      text: "Any change-log line the response proposes is in business language and names no input file, path or page.",
    },
  ],
  build(dir) {
    seedMapping(dir);
    write(dir, "docs/policies/refund-policy.md", POLICY);
    return buildPrompt(
      [
        "skills/ontology-build/references/candidate-review.md",
        "skills/ontology-build/references/candidates.md",
        "skills/ontology-build/references/save.md",
      ],
      "This project has no saved ontology and no ADRs. The user asked for a first model of refunds from docs/policies/refund-policy.md:",
      "```markdown",
      POLICY,
      "```",
      "사용자: 문서에는 없지만, 환불은 모두 고객지원팀장이 승인하는 걸로 우리가 정했어.",
      "Do not call tools. Show the `rules` entries of the candidates file you would write, and the change-log line you would propose for saving them.",
    );
  },
};
