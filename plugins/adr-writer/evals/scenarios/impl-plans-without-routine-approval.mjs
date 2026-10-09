import {
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
  write,
} from "../lib/harness.mjs";

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

function taggedSummary(tail, tag) {
  return tail.findings.find((finding) => finding.tag === tag)?.summary ?? "";
}

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

  score({ tail, output }) {
    const planUpdate = taggedSummary(tail, "PLAN_UPDATE");
    const approval = taggedSummary(tail, "APPROVAL");
    const adrChange = taggedSummary(tail, "ADR_CHANGE");
    const prose = output.split(/===\s*EVAL-VERDICT:/i)[0];
    const negativeRequired = /required\s*=\s*(?:false|no|not required|없음|아니오)/i;

    return [
      {
        pass:
          /presentation\s*=\s*[^;]*(?:non.?blocking|progress|비차단|진행 상황|진행 보고)/i.test(
            planUpdate,
          ) &&
          /scope\s*=\s*[^;]*(?:webhook|handler|signature|웹훅|서명)/i.test(planUpdate) &&
          /tests\s*=\s*[^;]*(?:signature|duplicate|audit|서명|중복|감사)/i.test(planUpdate) &&
          /comprehensionLoad\s*=\s*(?:[1-9]|10)\s*\/\s*10/i.test(planUpdate) &&
          /proceed\s*=\s*(?:true|yes|immediate|now|즉시|진행)/i.test(planUpdate),
        detail: planUpdate || "missing PLAN_UPDATE",
        label: "publishes a complete non-blocking plan and proceeds",
      },
      {
        pass:
          negativeRequired.test(approval) &&
          /reason\s*=\s*[^;]*(?:approved|unchanged|same revision|승인|변경 없)/i.test(approval),
        detail: approval || "missing APPROVAL",
        label: "does not require routine implementation-plan approval",
      },
      {
        pass:
          negativeRequired.test(adrChange) &&
          /status\s*=\s*[^;]*Accepted/i.test(adrChange) &&
          /reason\s*=\s*[^;]*(?:unchanged|no [^;]*change|same contract|behavior-preserving|변경\s*(?:없|되지 않)|무변경|동일|불변|동작 보존)/i.test(
            adrChange,
          ) &&
          /Accepted\s*\(\d{4}-\d{2}-\d{2}\)/i.test(prose) &&
          /(?:retain|remain|unchanged|no transition|유지|변경 없|전환 스크립트.*(?:실행하지|미실행))/i.test(
            prose,
          ),
        detail: adrChange || "missing ADR_CHANGE",
        label: "keeps the unchanged ADR authoritative and Accepted",
      },
      {
        pass:
          /(?:progress update|progress report|non.?blocking|진행 상황|진행 보고|비차단)/i.test(
            prose,
          ) && /(?:test|verification|검증|테스트)/i.test(prose),
        detail:
          /(?:progress update|progress report|non.?blocking|진행 상황|진행 보고|비차단)/i.test(
            prose,
          ) && /(?:test|verification|검증|테스트)/i.test(prose)
            ? "visible progress framing and test scope are both present"
            : "missing progress framing or test scope in the visible report",
        label: "visible report presents the plan as progress rather than a gate",
      },
      expectNoText(
        prose,
        /(?:please approve|approval is required|do not proceed until approval|shall I proceed|may I proceed|confirm (?:the )?(?:implementation )?plan|계획을 승인|승인해 ?주세요|승인 후 진행|계획을 확인해 ?주세요|진행해도 될까요|진행할까요)/i,
        "visible report does not ask for routine plan approval",
      ),
    ];
  },
};
