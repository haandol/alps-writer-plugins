import {
  agentText,
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  write,
} from "../lib/harness.mjs";

const ADR = `# ADR 0001: tenant-scoped payment callbacks

Date: 2026-08-18

## Status

Accepted (2026-08-18)

## Context

Provider callbacks update tenant-owned payments.

## Decision Drivers

- A callback must never cross a tenant boundary.
- Duplicate callbacks must not complete a payment twice.

## Decision

Payment callbacks resolve the owning tenant before applying an idempotent completion.

### Requirement contract

- A callback may mutate only a payment owned by the authenticated tenant.
- Duplicate callbacks complete a payment at most once.

### Alternatives

- Resolve tenant ownership in the callback handler.
- Reconcile callbacks asynchronously.

## Consequences

Callback identity and idempotency must be verified.

## Related

- 없음
`;

export const obligations = [
  {
    id: "premise",
    text: "Identify the unverified premise that incoming x-tenant-id cannot be forged or overridden. Explain cross-tenant payment mutation if false and the missing signature/header provenance/gateway configuration or adversarial verification. Do not invent such evidence.",
  },
  {
    id: "coverage",
    text: "Keep tenant-isolation R1 UNVERIFIED and the overall result INCONCLUSIVE, never PASS. Preserve proven duplicate-completion R2 and recommend the missing provenance verification, without routine architecture approval.",
  },
  {
    id: "discretion",
    text: "Treat the verified 250 ms retry delay as an implementation choice below ADR resolution. It preserves the contracts and affects latency/request rate; do not invent an ADR decision or ask approval for it.",
  },
];

export default {
  name: "impl-review-surfaces-hidden-contract-assumption",
  description:
    "/adr-impl-review must surface an unverified input-provenance premise that can violate tenant isolation, while leaving unrelated verified implementation discretion below ADR resolution.",
  bugReport:
    "“코드는 계약을 지키는 것처럼 보였지만 tenant header가 신뢰할 수 있다는 숨은 가정을 아무도 확인하지 않아 PASS가 났다.”",

  build(dir) {
    seedRuleDocs(dir);
    write(dir, "docs/adr/payments/callback/0001-tenant-scoped-callbacks.md", ADR);
    seedMapping(dir, {
      categories: {
        "payments/callback": {
          feature: "Tenant-scoped payment callbacks",
          adrs: [
            {
              path: "docs/adr/payments/callback/0001-tenant-scoped-callbacks.md",
              status: "Accepted (2026-08-18)",
              summary: "Payment callbacks resolve tenant ownership before idempotent completion",
            },
          ],
          dependsOn: [],
        },
      },
    });

    return [
      skillText("adr-impl-review", {
        references: [
          "skills/adr-impl-review/references/full-review.md",
          "skills/adr-impl-review/references/evidence-synthesis.md",
        ],
      }),
      agentText("adr-impl-sufficiency-reviewer"),
      `\n---\n\n# This run`,
      `Perform the sufficiency classification from only the supplied facts. Do not invent`,
      `gateway configuration, provider guarantees, signatures, tests, or code paths.`,
      ``,
      `ADR contract:`,
      `- R1: A callback may mutate only a payment owned by the authenticated tenant.`,
      `- R2: Duplicate callbacks complete a payment at most once.`,
      ``,
      `Implementation and evidence:`,
      `- The callback handler reads x-tenant-id directly from the incoming request header.`,
      `- It queries the payment repository with that tenant id and the payment id.`,
      `- No inspected code verifies a callback signature or the header's provenance.`,
      `- No supplied gateway or deployment configuration proves that callers cannot set or`,
      `  override x-tenant-id.`,
      `- The nominal test supplies x-tenant-id itself and verifies only the matching-tenant path.`,
      `- An idempotency-key uniqueness test passes and proves R2.`,
      `- Retry scheduling uses a fixed 250 ms delay. The delay is covered by a timing test,`,
      `  preserves both ADR contracts, and only affects recovery latency and request rate.`,
      ``,
      `In EVAL-FINDINGS use exactly these four tags and include every named field:`,
      `CONTRACT_R1 | status=...; reason=...`,
      `ASSUMPTION_RISK | premise=...; impactIfFalse=...; evidenceMissing=...`,
      `SAFE_CHOICE | value=...; classification=...; reason=...`,
      `HUMAN_REVIEW | verdict=...; action=...; routineApproval=false`,
      TAIL_SPEC,
    ].join("\n");
  },
};
