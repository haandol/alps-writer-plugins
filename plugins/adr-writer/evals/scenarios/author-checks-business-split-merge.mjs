import {
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";
import {
  adrDocument,
  commitFixture,
  SETTLED_MODEL,
  settledMapping,
} from "../lib/ontology-fixtures.mjs";

const REQUEST = adrDocument({
  title: "Request a payment for each placed order",
  purpose: "Every placed order gets one payment request.",
  decision: "Create a payment request when an order is placed.",
  rows: ["A placed order gets exactly one payment request."],
});
const CAPTURE = adrDocument({
  number: "0002",
  title: "Capture a requested payment once",
  purpose: "Customers are never charged twice.",
  decision: "Capture a requested payment once and announce Payment completed.",
  rows: [
    "A requested payment is captured at most once.",
    "A successful capture announces Payment completed once.",
  ],
});
const record = (path, summary) => ({ path, status: "Accepted (2026-10-01)", summary });
const MAPPING = settledMapping({
  payments: {
    feature: "Payments",
    adrs: [
      record(
        "docs/adr/payments/0001-request-payment.md",
        "a placed order gets one payment request",
      ),
      record("docs/adr/payments/0002-capture-once.md", "a requested payment is captured once"),
    ],
    realizes: ["payment.request-payment", "payment.capture-payment"],
    dependsOn: [],
  },
  "gift-wrap": {
    feature: "Gift wrapping",
    adrs: [record("docs/adr/gift-wrap/0001-wrap.md", "orders can be wrapped")],
    realizes: [],
    dependsOn: [],
  },
  packaging: {
    feature: "Packaging",
    adrs: [record("docs/adr/packaging/0001-pack.md", "orders are packed")],
    realizes: [],
    dependsOn: [],
  },
});

export const obligations = [
  {
    id: "no-query",
    text: "Splitting payments into payment-request and payment-capture, and merging gift-wrap and packaging into order-extras, keep every meaning, so the response does not query or re-judge the business context for them.",
  },
  {
    id: "links-move",
    text: "In the split, each realization link moves to the category whose ADR holds that step's contract: Request the payment to payment-request and Capture the payment to payment-capture; no link is lost.",
  },
  {
    id: "empty-record",
    text: "The merged order-extras category starts without an empty realizes record (the merged categories' empty records are not carried over), and the new split categories get no empty record either.",
  },
  {
    id: "approval",
    text: "The category changes are presented for approval before any file or index change.",
  },
].map((o) => ({ ...o, label: `split and merge: ${o.id}` }));

export default {
  name: "author-checks-business-split-merge",
  description:
    "Meaning-preserving category splits and merges move realization links to the owning category, carry no empty record and do not query the business context.",
  obligations,
  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING, {
      "docs/adr/payments/0001-request-payment.md": REQUEST,
      "docs/adr/payments/0002-capture-once.md": CAPTURE,
    });
    write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
    commitFixture(dir);
    return [
      skillText("adr-sync", { references: ["references/business-context.md"] }),
      `\n---\n\n# This run`,
      "/adr-sync",
      "",
      "카테고리를 정리해 줘. payments는 결제 요청(payment-request)과 매입(payment-capture)으로 나누고, gift-wrap과 packaging은 order-extras 하나로 합쳐 줘. 결정 내용은 그대로야.",
      "",
      "docs/adr/.mapping.json:",
      "```json",
      JSON.stringify(MAPPING, null, 2),
      "```",
      "docs/adr/payments/0001-request-payment.md:",
      "```markdown",
      REQUEST,
      "```",
      "docs/adr/payments/0002-capture-once.md:",
      "```markdown",
      CAPTURE,
      "```",
      "Do not call tools or write files. Show the resulting categories and realization links you would propose for approval.",
      "In the tail use QUERY, LINK, EMPTY_RECORD and APPROVAL tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
