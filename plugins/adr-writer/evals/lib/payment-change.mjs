import {
  hookContext,
  seedIndexedAdrs,
  seedMapping,
  seedRuleDocs,
  skillText,
  TAIL_SPEC,
  write,
} from "./harness.mjs";
import {
  CAPTURE_CODE,
  CHECKOUT_ADR,
  commitFixture,
  CONFIRMATION_ADR,
  ontologyDirective,
  RETRY_ADR,
  SETTLED_MODEL,
  settledMapping,
} from "./ontology-fixtures.mjs";

const proposal = ".adr-review/change/proposal.md";
const changes = {
  rule: {
    request: "주문 금액의 절반 이상을 결제한 주문도 확정할 수 있도록 바꿔 줘.",
    description: "A partial payment changes the cross-step condition for confirming an order.",
    obligation:
      "The written proposal asks for approval of the change to the payment-to-confirmation rule through Ontology Writer. It separates the half-of-order threshold as a pending ADR requirement. No dependent contract is finalized or implemented before the change to the rule is approved.",
    contextId: "payment.amount-matches-order",
  },
  value: {
    request: "카드가 거절된 주문의 결제 재시도 한도를 3회에서 5회로 늘려 줘.",
    description: "A retry-limit change is confined to the payments ADR.",
    obligation:
      "The written proposal revises the existing payments ADR in place from three retries to five and retains rejection of the next attempt. It asks for ADR approval and preserves the business model without a model-change proposal. The applicable business rule and hand-off retain their meaning.",
    contextId: "payment.capture-payment",
  },
};

/** Exercise the same unapproved request with a session directive or the ADR authoring skill. */
export function paymentChangeScenario(name, kind, { authoring = false } = {}) {
  const change = changes[kind];
  return {
    name,
    description: change.description,
    businessContext: true,
    directiveOnly: !authoring,
    // The authoring path is a heavy agentic run that exceeds the default 300 s.
    ...(authoring ? { agentTimeoutMs: 600_000 } : {}),
    artifactPaths: [proposal],
    obligations: [{ id: "approval-proposal", text: change.obligation }],
    build(dir) {
      const mapping = settledMapping();
      seedRuleDocs(dir);
      seedMapping(dir, mapping);
      seedIndexedAdrs(dir, mapping, {
        "docs/adr/payments/0001-card-capture.md": RETRY_ADR,
        "docs/adr/checkout/0001-submit-orders.md": CHECKOUT_ADR,
        "docs/adr/confirmation/0001-confirm-paid.md": CONFIRMATION_ADR,
      });
      write(dir, "docs/ontology/ordering.ttl", SETTLED_MODEL);
      write(dir, "src/payments/capture.ts", CAPTURE_CODE);
      // The proposal is the only authorized write. Its disposable report directory is already ignored.
      write(dir, ".adr-review/.gitignore", "*\n");
      const instructions = authoring
        ? [
            skillText("adr-new", { references: ["references/business-context.md"] }),
            ontologyDirective(dir),
          ].join("\n")
        : [hookContext(dir, mapping), ontologyDirective(dir)].join("\n");
      commitFixture(dir);
      return [
        instructions,
        "# This run",
        "The query_business_context fixture tool runs the installed Ontology Writer query locally. Use fixture tools for file operations.",
        authoring ? "/adr-new payments" : "",
        change.request,
        `검토할 첫 변경안을 ${proposal}에 작성해 줘. 원본 반영은 제안서를 읽고 승인한 뒤에 한다.`,
        TAIL_SPEC,
      ]
        .filter(Boolean)
        .join("\n\n");
    },
    mechanicalScore({ events }) {
      const firstWrite = events.find(
        (event) =>
          event.kind === "request" &&
          event.tool === "write_file" &&
          event.arguments?.path === proposal,
      );
      const queries = events.filter(
        (event) =>
          event.kind === "result" &&
          event.tool === "query_business_context" &&
          event.ok &&
          typeof event.result === "string" &&
          firstWrite &&
          event.seq < firstWrite.seq,
      );
      const checks = [
        {
          label: "Relevant business context was returned before drafting",
          pass: queries.some((event) => event.result.includes(change.contextId)),
          detail: `Expected ${change.contextId} in a successful query before the first proposal write`,
        },
        {
          label: "Model text was obtained only through the business-context query",
          pass:
            !events.some(
              (event) =>
                event.kind === "request" &&
                event.tool === "read_file" &&
                typeof event.arguments?.path === "string" &&
                event.arguments.path.startsWith("docs/ontology/"),
            ) &&
            events
              .filter((event) => event.kind === "result" && event.ok && event.tool === "search")
              .every(
                (event) =>
                  Array.isArray(event.matchedPaths) &&
                  event.matchedPaths.every((file) => !file.startsWith("docs/ontology/")),
              ),
          detail:
            "Checks direct reads and actual search hits. An older search trace without matched paths cannot establish this check.",
        },
      ];
      if (authoring && kind === "value")
        checks.push({
          label:
            "The payment observation criterion was retrieved before proposing the ADR revision",
          pass: queries.some((event) =>
            event.result.includes("criterion payment.take-payment.completed "),
          ),
          detail:
            "The feature query supplies the linked steps; the process query returns this fixture's criterion",
        });
      return checks;
    },
  };
}
