import {
  agentText,
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
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

function taggedSummary(tail, tag) {
  return tail.findings.find((finding) => finding.tag === tag)?.summary ?? "";
}

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

  score({ tail, output }) {
    const r1 = taggedSummary(tail, "CONTRACT_R1");
    const assumption = taggedSummary(tail, "ASSUMPTION_RISK");
    const safeChoice = taggedSummary(tail, "SAFE_CHOICE");
    const humanReview = taggedSummary(tail, "HUMAN_REVIEW");
    const all = `${output}\n${tail.raw}`;

    return [
      {
        pass: tail.verdict === "INCONCLUSIVE",
        detail: `verdict=${tail.verdict ?? "missing"}`,
        label: "returns INCONCLUSIVE instead of PASS",
      },
      {
        pass:
          /status\s*=\s*UNVERIFIED/i.test(r1) &&
          /(?:tenant|header|provenance|인증|출처|신뢰)/i.test(r1),
        detail: r1 || "missing CONTRACT_R1",
        label: "marks the affected tenant-isolation contract UNVERIFIED",
      },
      {
        pass:
          /premise\s*=\s*[^;]*(?:x-tenant-id|header|gateway|trusted|신뢰|출처)/i.test(assumption) &&
          /impactIfFalse\s*=\s*[^;]*(?:cross.?tenant|tenant isolation|다른 tenant|테넌트|계약|security|보안)/i.test(
            assumption,
          ) &&
          /evidenceMissing\s*=\s*[^;]*(?:gateway|signature|provenance|configuration|config|test|서명|설정|검증)/i.test(
            assumption,
          ),
        detail: assumption || "missing ASSUMPTION_RISK",
        label: "surfaces the premise, contract impact, and missing verification",
      },
      {
        pass:
          /250\s*ms/i.test(safeChoice) &&
          /classification\s*=\s*[^;]*(?:Notable implementation choice|implementation discretion|below ADR|구현 재량|ADR.*아래)/i.test(
            safeChoice,
          ) &&
          /preserv|유지|보존|contract|계약/i.test(safeChoice),
        detail: safeChoice || "missing SAFE_CHOICE",
        label: "does not over-escalate the verified retry choice",
      },
      {
        pass:
          /verdict\s*=\s*INCONCLUSIVE/i.test(humanReview) &&
          /action\s*=\s*[^;]*(?:verify|gateway|signature|provenance|검증|서명|설정)/i.test(
            humanReview,
          ) &&
          /routineApproval\s*=\s*false/i.test(humanReview),
        detail: humanReview || "missing HUMAN_REVIEW",
        label: "escalates only the unverified contract-affecting premise",
      },
      expectNoText(
        all,
        /(?:historical rationale|private reasoning|chain[- ]of[- ]thought|내부 사고|사고 과정).{0,80}(?:required|provide|제공|설명)/i,
        "does not request private reasoning",
      ),
    ];
  },
};
