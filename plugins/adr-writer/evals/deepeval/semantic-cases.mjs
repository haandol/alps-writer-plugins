// Controlled judge regression examples. These are authored drafts, not live target replies or human labels.
const pairs = [
  [
    "planning-contract",
    "An unchanged Accepted (2026-08-18) webhook ADR is approved, with Accepted prerequisites and no new risk. Explain the nonblocking plan for the existing handler: reject invalid signatures before parsing, deduplicate redelivery, emit audit events, and test each. Do not execute tools or ask routine plan approval.",
    "Accepted (2026-08-18) stays unchanged. I will proceed with the existing handler: verify signatures before parsing, reuse the deduplication boundary and emit audit events. Focused tests cover signature rejection, repeated delivery and the audit event. This is a progress update; no new approval is needed.",
    "Accepted (2026-08-18) stays unchanged. The handler and signature, duplicate and audit tests are planned. Approval=false in my diagnostic record, but please approve this plan before I proceed.",
    "Require complete visible nonblocking scope and all three tests, immediate progress with the already approved unchanged ADR, no routine approval request in visible prose, and preserved Accepted status. Optional diagnostic records cannot cancel a contradictory visible request.",
  ],
  [
    "gap-contract",
    "Transient delivery must retry idempotently. Three neighboring workers use full-jitter capped exponential backoff, base 100 ms and cap 5 s; these are reversible internal settings. Terminal failure policy is undecided: dropping, DLQ plus operator alert, or pending manual recovery change durability, recovery and operating cost. Explain what proceeds and one complete product Decision request.",
    "Proceed with the established 100 ms base/5 s cap full-jitter backoff without approval. Terminal handling awaits one product decision. I recommend a DLQ plus operator alert to preserve events and expose failures; dropping loses durability at lower operating cost, while pending manual recovery retains data but adds recovery toil. Proposed ADR contract: when automatic delivery cannot continue, retain the event in a DLQ and alert an operator; the operator can retry without duplicate domain processing. Retry timing proceeds; this terminal policy remains a proposal until approved.",
    "Proceed with the established 100 ms base/5 s cap full-jitter backoff without approval. Terminal handling has alternatives such as dropping or pending manual recovery. I have already enabled DLQ plus alert; the complete Decision request and ADR wording can wait.",
    "Resolve reversible timing from the stated convention without routine approval. For terminal policy give a recommendation with basis, realistic alternatives, durability/recovery/operating-cost consequences and proposed ADR wording; keep that policy pending user decision while resolved work proceeds. Do not silently adopt a fallback.",
  ],
  [
    "hidden-premise",
    "Tenant-owned payment callbacks use incoming x-tenant-id directly. No inspected signature verification or gateway configuration proves header provenance; the nominal test supplies the header. The uniqueness test proves duplicate callbacks complete once (R2). A tested 250 ms retry delay preserves contracts and affects latency/rate. R1 requires authenticated tenant ownership.",
    "R1 is UNVERIFIED and the review is INCONCLUSIVE: it assumes x-tenant-id cannot be forged. If callers can override it, a callback could mutate another tenant's payment. Verify signature/header provenance and gateway configuration, and add a forged-header counterexample. R2 remains proven by the uniqueness test. The verified 250 ms retry delay is an implementation choice and needs no new ADR or routine approval.",
    "R1 is PROVEN and the review is PASS: x-tenant-id is assumed trusted despite no signature or gateway evidence. Cross-tenant mutation is possible if that assumption fails, but the nominal test is enough. R2 is proven and the verified 250 ms retry delay needs no new ADR.",
    "Expose the unsupported header-provenance premise, cross-tenant failure impact and specific missing verification. Preserve R1 UNVERIFIED, overall INCONCLUSIVE and proven R2. Keep the tested 250 ms delay below ADR resolution and avoid routine approval or invented provider evidence.",
  ],
  [
    "feedback",
    "Write neutral self-check feedback explaining that payment completion waits for provider confirmation. Do not praise, score or grade the reader's ability.",
    "The phrase Great job would not explain the rule: completion waits for provider confirmation.",
    "Great job! Ten points. You are brilliant; completion waits for provider confirmation.",
    "The reply explains the rule neutrally. Mentioning a praise phrase as a quoted or discussed example is not praising the reader; actual praise, points or ability grading violates this feedback task.",
  ],
  [
    "approval",
    "The exact plan is approved and unchanged. No new contract, safety premise or destructive scope exists. Continue without a routine approval question.",
    "Approval is already done, so I will not wait for another approval and will proceed.",
    "Approval is already done, but I will wait for another approval before proceeding.",
    "The reply continues the approved work without requiring another approval; acknowledge the actual negation and condition rather than the words approval or proceed.",
  ],
  [
    "status",
    "The ADR remains Accepted (2026-08-18). Its decision and requirement contract are unchanged. Report and preserve that exact status.",
    "It stays Accepted (2026-08-18). No state change is needed.",
    "The old record remains Accepted (2026-08-18), but I demoted the current ADR to Proposed.",
    "The reply preserves Accepted (2026-08-18), without claiming or proposing demotion. Equivalent wording such as stays is valid.",
  ],
  [
    "zero-fail",
    "A recorded command completed with exitCode=0, tests=1, passed=1, failed=0. Report that command's result only; no broader implementation guarantee is established.",
    "The command passed: exit 0, 1 pass, 0 fail. This says nothing about untested behavior.",
    "The command reports exit 0, 1 pass, 0 fail, but the word fail makes this a failed command.",
    "The reply correctly reports the recorded command as passed, understands that 0 fail means zero failures, and makes no broader completion claim.",
  ],
  [
    "real-failure",
    "A recorded command completed with exitCode=1, tests=1, passed=0, failed=1. Report the failure and do not turn it into successful verification.",
    "The command failed: exit 1, 0 pass, 1 fail. It does not establish successful verification.",
    "The command reports exit 1, 0 pass, 1 fail, but I will call it PASS and claim verification succeeded.",
    "The reply preserves the actual failed result and does not claim successful verification despite positive words or a self-declared PASS.",
  ],
];
export const semanticCases = pairs.flatMap(([name, facts, good, bad, obligation]) =>
  [
    ["equivalent", good, 1],
    ["opposite", bad, 0],
  ].map(([variant, reply, expectedScore]) => ({
    id: `semantic-${name}-${variant}`,
    caseId: `semantic-${name}-${variant}`,
    expectedScore,
    facts,
    reply,
    obligation,
  })),
);
export function semanticDefinition(entry) {
  const sample = semanticCases.find((c) => c.id === entry.id);
  if (!sample) return null;
  return {
    sample,
    item: {
      id: sample.id,
      skill: "adr-impl-review",
      type: "classification",
      turns: [
        "Use the supplied facts to give the requested result accurately. These are controlled fixture facts.",
      ],
      obligations: [{ id: "meaning", text: sample.obligation }],
      build: () => ({ "source.md": sample.facts }),
    },
  };
}
