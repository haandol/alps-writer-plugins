import { responseChecks } from "../lib/response-checks.mjs";

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
    text: "The AUTO_RESOLVE, DECISION_REQUEST and PROGRESS records agree with the visible response, including approval=false and routinePlanApproval=false. No tools or file changes occur.",
  },
];

/** Exact output/scope checks supplement the semantic obligations. */
export function deterministicScore(input) {
  return responseChecks(
    input,
    {
      AUTO_RESOLVE: ["gap", "resolution", "basis", "approval"],
      DECISION_REQUEST: ["gap", "recommendation", "basis", "alternatives", "impact", "adrPatch"],
      PROGRESS: ["proceed", "blockedOn", "routinePlanApproval"],
    },
    { noTools: true },
  );
}

import {
  skillText,
  seedRuleDocs,
  seedMapping,
  TAIL_SPEC,
  expectNoText,
  write,
} from "../lib/harness.mjs";

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

function taggedSummary(tail, tag) {
  return tail.findings.find((finding) => finding.tag === tag)?.summary ?? "";
}

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
      skillText("adr-impl"),
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

  score({ tail, output }) {
    const autoResolve = taggedSummary(tail, "AUTO_RESOLVE");
    const decisionRequest = taggedSummary(tail, "DECISION_REQUEST");
    const progress = taggedSummary(tail, "PROGRESS");
    const all = `${output}\n${tail.raw}`;
    const prose = output.split(/===\s*EVAL-VERDICT:/i)[0];

    return [
      {
        pass:
          /gap\s*=\s*[^;]*(?:retry|timing|backoff|재시도)/i.test(autoResolve) &&
          /resolution\s*=\s*[^;]*(?:exponential|jitter|100\s*ms|5\s*s|지수|지터)/i.test(
            autoResolve,
          ) &&
          /basis\s*=\s*[^;]*(?:neighbor|sibling|project convention|three|3|관례|인접)/i.test(
            autoResolve,
          ) &&
          /approval\s*=\s*false/i.test(autoResolve),
        detail: autoResolve || "missing AUTO_RESOLVE",
        label: "auto-resolves the reversible retry gap from project convention",
      },
      {
        pass:
          /gap\s*=\s*[^;]*(?:terminal|exhaust|failure|재시도 소진|최종 실패)/i.test(
            decisionRequest,
          ) &&
          /recommendation\s*=\s*[^;]*(?:DLQ|dead.?letter|operator alert|알림)/i.test(
            decisionRequest,
          ) &&
          /basis\s*=\s*[^;]+/i.test(decisionRequest) &&
          /alternatives\s*=\s*[^;]*(?:drop|manual|pending|폐기|수동|보류)/i.test(decisionRequest) &&
          /impact\s*=\s*[^;]*(?:durab|recovery|operat|cost|복구|운영|비용)/i.test(
            decisionRequest,
          ) &&
          /adrPatch\s*=\s*[^;]*(?:failure|delivery|DLQ|실패|전달)/i.test(decisionRequest),
        detail: decisionRequest || "missing DECISION_REQUEST",
        label: "packages the durable fallback gap as a complete Decision request",
      },
      {
        pass:
          /proceed\s*=\s*[^;]*(?:retry|timing|backoff|Gap A|재시도)/i.test(progress) &&
          /blockedOn\s*=\s*[^;]*(?:terminal|fallback|Gap B|최종 실패)/i.test(progress) &&
          /routinePlanApproval\s*=\s*false/i.test(progress),
        detail: progress || "missing PROGRESS",
        label: "continues resolved work and blocks only on the product decision",
      },
      expectNoText(
        all,
        /(?:approve|approval|승인).{0,80}(?:100\s*ms|5\s*s|retry timing|backoff|재시도 간격)/i,
        "does not ask the user to approve the established retry default",
      ),
      expectNoText(
        prose,
        /(?:please approve|approval is required|shall I proceed|may I proceed|confirm (?:the )?(?:implementation )?plan|계획을 승인|승인해 ?주세요|승인 후 진행|계획을 확인해 ?주세요|진행해도 될까요|진행할까요)/i,
        "does not hide a routine plan-approval gate in the visible report",
      ),
    ];
  },
};
