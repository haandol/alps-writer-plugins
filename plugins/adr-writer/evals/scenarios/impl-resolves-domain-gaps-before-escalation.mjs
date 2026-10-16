export const obligations = [
  {
    id: "default",
    text: "For Gap A choose the three neighboring workers' capped exponential backoff with full jitter, 100 ms base and 5 s cap as reversible internal convention, without requesting routine approval.",
  },
  {
    id: "policy",
    text: "For Gap B provide one complete Decision request: recommendation and evidence-based rationale, alternatives, durability/recovery/cost impact and proposed ADR contract wording. Do not silently adopt terminal failure policy; state what can proceed and what awaits the user's decision.",
  },
  {
    id: "scope",
    text: "The visible response distinguishes resolved timing work from the pending product decision and does not ask for routine plan approval. Any optional diagnostic records agree with that response. No tools or file changes occur.",
  },
];

import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC, write } from "../lib/harness.mjs";

const ADR = `# ADR 0001: idempotent webhook delivery

Date: 2026-08-18

## Status

Accepted (2026-08-18)

## Context

Transient webhook failures must recover without duplicate processing.

## Decision Drivers

- Transient failures should recover automatically.
- Duplicate delivery must not duplicate the domain action.
- Delivery behavior must remain observable.

## Decision

Webhook delivery retries transient failures through an idempotent consumer.

### Requirement contract

- Transient webhook failures are retried.
- The same webhook event is processed at most once.

### Alternatives

- Retry in the delivery worker.
- Reconcile failed events in a periodic job.

## Consequences

Delivery needs retry and idempotency evidence.

## Related

- 없음
`;

export default {
  name: "impl-resolves-domain-gaps-before-escalation",
  description:
    "/adr-impl must auto-resolve a reversible retry-timing gap from established project convention while packaging an unresolved durable-fallback policy as one complete Decision request.",
  bugReport:
    "“ADR에 없는 건 전부 알아서 정하거나 전부 질문한다. 도메인 상식과 저장소 관례로 채울 수 있는 부분은 채우고, 실제 제품 판단만 정리해서 물어봐야 한다.”",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/integrations/webhook/0001-idempotent-delivery.md", ADR);
    seedMapping(dir, {
      categories: {
        "integrations/webhook": {
          feature: "Idempotent webhook delivery",
          adrs: [
            {
              path: "docs/adr/integrations/webhook/0001-idempotent-delivery.md",
              status: "Accepted (2026-08-18)",
              summary: "Webhook delivery retries transient failures through an idempotent consumer",
            },
          ],
          dependsOn: [],
        },
      },
    });

    return [
      skillText("adr-impl", { references: ["skills/adr-impl/references/planning.md"] }),
      `\n---\n\n# This run`,
      `The ADR revision above is already approved and unchanged. Classify the following`,
      `planning gaps without executing tools or changing files.`,
      ``,
      `Gap A — retry timing:`,
      `- The ADR requires transient retries but does not choose a timing formula.`,
      `- Three neighboring delivery workers all use capped exponential backoff with full jitter,`,
      `  100 ms base, and 5 s cap.`,
      `- These values are internal, reversible, and do not change the public contract.`,
      ``,
      `Gap B — terminal failure:`,
      `- The ADR does not say what happens when delivery cannot continue.`,
      `- The product could drop the event, send it to a DLQ with an operator alert, or keep it`,
      `  pending for manual recovery.`,
      `- These options change durability, user-visible recovery, operational cost, and fallback.`,
      ``,
      `In EVAL-FINDINGS use exactly these three tags and include every named field:`,
      `AUTO_RESOLVE | gap=...; resolution=...; basis=...; approval=false`,
      `DECISION_REQUEST | gap=...; recommendation=...; basis=...; alternatives=...; impact=...; adrPatch=...`,
      `PROGRESS | proceed=...; blockedOn=...; routinePlanApproval=false`,
      TAIL_SPEC,
    ].join("\n");
  },
};
