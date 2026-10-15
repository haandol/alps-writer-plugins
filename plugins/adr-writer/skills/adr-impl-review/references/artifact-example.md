# Implementation review artifact example

Read only when a worked serialization example is useful. This abbreviated
payload illustrates field families; it is not a complete, validator-ready review.
Use [the native schema](artifact-schema.md) and the reviewed evidence for every
actual row, required artifact and optional field. Quiz fields apply only when
[quiz artifacts](quiz-artifact.md) are included.

```json
{
  "language": "en",
  "reviewMode": "full",
  "adr": "docs/adr/ordering/checkout/0001-checkout.md",
  "status": "Accepted (2026-07-10)",
  "verdict": "FIX_REQUIRED",
  "atAGlance": {
    "impact": "A cancelled checkout can still leave an upstream request running.",
    "action": "Pass the cancellation signal through the upstream client and rerun the cancellation test.",
    "risk": "Restart recovery remains unverified because no local queue was available."
  },
  "relatedAdrComparisons": [],
  "relatedAdrComparisonOmissionReason": "No other ADR shares the reviewed settlement boundary closely enough to reduce reconstruction work.",
  "diagramRequirements": [
    {
      "id": "V1",
      "question": "Who returns the stored payment result, and in what order?",
      "diagramType": "sequenceDiagram",
      "section": "A duplicate request reuses the completed payment",
      "reason": "The sequence separates a retry from new provider work.",
      "evidence": "src/checkout/handler.ts and src/checkout/client.ts cancellation path"
    },
    {
      "id": "V2",
      "question": "Which components own the stored result and new settlement?",
      "diagramType": "flowchart",
      "section": "A duplicate request reuses the completed payment",
      "reason": "A component view identifies ownership that call order alone does not explain.",
      "evidence": "checkout cancellation test and upstream abort result"
    }
  ],
  "reviewHike": {
    "context": {
      "intent": "Payment settlement creates one durable result.",
      "preconditions": "Settlement receives retries and provider outcomes.",
      "contracts": "One completion boundary preserves idempotency and pending state.",
      "scopeAndRisk": "Retry and provider-failure paths determine the verdict."
    },
    "hills": [
      {
        "id": "H1",
        "title": "A duplicate request reuses the completed payment",
        "sliceType": "user-flow",
        "sliceName": "Duplicate payment settlement",
        "reviewQuestion": "Can the same payment request complete more than once?",
        "diagramIds": ["V1", "V2"],
        "container": {
          "responsibility": "Reuse one durable settlement for a retry.",
          "interactions": "The request reaches the completion boundary and stored result.",
          "outcome": "The customer is charged at most once."
        },
        "components": [
          {
            "id": "C1",
            "name": "Idempotent completion boundary",
            "responsibility": "Separate new work from retries.",
            "implementation": "Return the stored result for a completed key.",
            "verification": "The duplicate-settlement test observes one completion.",
            "codeEvidence": [
              {
                "kind": "diff",
                "location": "src/payments/settle.ts:42",
                "content": "- write(result)\n+ return existing ?? write(result)",
                "explanation": "The retry path no longer writes twice.",
                "tests": "pnpm test -- settlement — PASS"
              }
            ]
          }
        ],
        "contractIds": ["D0", "R1"]
      }
    ]
  },
  "explanation": "/tmp/.../explanation.md",
  "report": "/tmp/.../implementation-review.md",
  "scope": ["src/checkout/handler.ts", "src/checkout/client.ts", "test/checkout.test.ts"],
  "changeScope": ["src/checkout/handler.ts"],
  "conventions": "AGENTS.md",
  "metrics": {
    "startedAt": "2026-08-15T06:30:00.000Z",
    "completedAt": "2026-08-15T06:35:42.000Z",
    "elapsedSeconds": 342,
    "necessityFindingCount": 1,
    "sufficiencyFindingCount": 0,
    "unverifiedRiskCount": 0,
    "testCommandCount": 2
  },
  "implementationChoices": [
    {
      "choice": "retry uses a 250 ms fixed delay",
      "evidence": "src/checkout/client.ts:42 — retryDelayMs: 250",
      "intentFit": "keeps retries bounded and preserves the ADR's explicit failure result",
      "whyItMatters": "changes recovery latency and upstream request rate"
    }
  ],
  "comprehensionCheck": {
    "prGuidance": "Code PASS and comprehension readiness are separate; PASS does not establish understanding. Unverified or failed comprehension does not block publishing by default. Publishing requires user authorization and repository checks. Only an explicitly selected user/team quiz gate requires every question to pass without consulting answers or criteria.",
    "questions": [
      {
        "id": "Q1",
        "question": "Which result preserves the completion boundary after provider failure?",
        "options": [
          {
            "id": "A",
            "text": "Mark the payment completed",
            "feedback": "Failure has not crossed the completion boundary."
          },
          {
            "id": "B",
            "text": "Keep the payment pending",
            "feedback": "This preserves the completion contract."
          },
          {
            "id": "C",
            "text": "Delete the payment",
            "feedback": "Deletion is not the recorded failure result."
          },
          {
            "id": "D",
            "text": "Retry forever",
            "feedback": "The contract does not allow unbounded retry."
          }
        ],
        "revisit": true,
        "correctOptionId": "B",
        "explanation": "Provider success is required before completion is recorded.",
        "evidence": "ADR R2; src/payments/settle.ts:42; provider failure test"
      }
    ]
  },
  "contractCoverage": [
    {
      "contractId": "R1",
      "requirement": "a payment is completed at most once",
      "status": "PROVEN",
      "adrBasis": "Requirement contract — Prohibitions",
      "implementation": "the settlement path rejects an existing idempotency key",
      "evidence": "src/payments/settle.ts:42 — exact code or execution evidence",
      "tests": "pnpm test -- settlement — PASS"
    }
  ],
  "findings": [
    {
      "category": "Unnecessary change",
      "perspective": "necessity",
      "summary": "the new event bus is not needed for this ADR",
      "whyItMatters": "the extra path increases maintenance and failure surface without changing the required behavior",
      "expectedBehavior": "cancellation reaches the upstream request through the existing signal path",
      "observedBehavior": "the same cancellation is routed through an additional event bus",
      "requestedChange": "remove the event bus and keep the direct cancellation path",
      "editTargets": "src/events/bus.ts and its checkout wiring",
      "completionCriteria": "the event bus is absent and the cancellation test still passes",
      "confidence": "high",
      "adrQuote": "on cancellation, abort the upstream call",
      "code": "src/events/bus.ts:18 — the actual code fragment",
      "evidence": "the existing abort-signal path meets the same goal",
      "test": "pnpm test -- cancel",
      "testResult": "pass after excluding the new bus path",
      "fix": "remove the new event bus and its wiring",
      "contractIds": ["D0"]
    }
  ],
  "notes": "review limits or contradictions"
}
```
