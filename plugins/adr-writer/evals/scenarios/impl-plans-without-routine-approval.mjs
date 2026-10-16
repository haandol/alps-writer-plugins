import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC, write } from "../lib/harness.mjs";

const ADR = `# ADR 0001: signed webhook ingestion

Date: 2026-08-18

## Status

Accepted (2026-08-18)

## Context

Inbound webhooks must reject forged requests and avoid duplicate domain actions.

## Decision Drivers

- Only authentic provider callbacks may enter the domain workflow.
- Redelivery must not repeat the domain action.
- Verification failures must remain observable.

## Decision

Verify the provider signature before parsing the callback, then process the event through
the existing idempotency boundary.

### Requirement contract

- A callback with an invalid signature is rejected before domain processing.
- Repeated delivery of the same provider event produces at most one domain action.
- Signature and duplicate rejections emit the existing webhook audit event.

### Alternatives

- Trust callbacks received through the public endpoint.
- Deduplicate in a periodic reconciliation job.

## Consequences

The handler needs signature, duplicate-delivery, and audit-event tests.

## Related

- 없음
`;

export const obligations = [
  {
    id: "progress",
    text: "Present the existing webhook handler scope and the signature-before-parsing, duplicate-redelivery and audit-event tests as a complete nonblocking progress update. Explain immediate implementation progress, without executing tools in this response-only fixture.",
  },
  {
    id: "approval",
    text: "The exact ADR revision is already approved and unchanged, all dependencies are Accepted and no new risk or policy gap exists. Do not ask for routine plan approval or wait for permission in the visible response, even if optional diagnostic records say approval=false.",
  },
  {
    id: "status",
    text: "Keep Accepted (2026-08-18) authoritative without changing its decision or requirement contract, demoting it to Proposed or running a status transition. Equivalent natural wording is allowed; optional tags do not establish correctness.",
  },
];

export default {
  name: "impl-plans-without-routine-approval",
  description:
    "/adr-impl must publish an unchanged approved ADR's implementation plan as a non-blocking progress update and proceed without routine approval.",
  bugReport:
    "“이미 승인된 ADR인데 구현 계획을 다시 승인해 달라고 멈춘다. 계약이 바뀌지 않았다면 계획은 공유하고 바로 진행해야 한다.”",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/integrations/webhook/0001-signed-ingestion.md", ADR);
    seedMapping(dir, {
      categories: {
        "integrations/webhook": {
          feature: "Signed webhook ingestion",
          adrs: [
            {
              path: "docs/adr/integrations/webhook/0001-signed-ingestion.md",
              status: "Accepted (2026-08-18)",
              summary: "Verify provider signatures before idempotent webhook domain processing",
            },
          ],
          dependsOn: [],
        },
      },
    });

    return [
      skillText("adr-impl", { references: ["skills/adr-impl/references/planning.md"] }),
      `\n---\n\n# This run`,
      `## Target ADR`,
      ``,
      ADR,
      `## Authoritative mapping state`,
      ``,
      `- path: docs/adr/integrations/webhook/0001-signed-ingestion.md`,
      `- status: Accepted (2026-08-18)`,
      ``,
      `The exact ADR revision shown above was already approved and has not changed.`,
      `All dependencies are Accepted. Planning found no contradictory premise,`,
      `unverified contract or safety assumption, destructive change, broad scope expansion,`,
      `or product-policy gap. No ADR Decision, Driver, requirement, or Consequence changes.`,
      ``,
      `The implementation scope is the existing webhook handler and its focused tests:`,
      `signature rejection before parsing, duplicate redelivery, and audit-event emission.`,
      ``,
      `Without executing tools or changing files, state how step 3 presents this plan and`,
      `whether implementation proceeds or waits for user approval.`,
      ``,
      `In EVAL-FINDINGS use exactly these three tags and include every named field:`,
      `PLAN_UPDATE | presentation=...; scope=...; tests=...; comprehensionLoad=...; proceed=...`,
      `APPROVAL | required=...; reason=...`,
      `ADR_CHANGE | required=...; status=<exact resulting ADR status>; reason=...`,
      TAIL_SPEC,
    ].join("\n");
  },
};
