import {
  REPORT_EVALUATION,
  REPORT_OUTPUT,
  REPORT_SOURCE_RULE,
  REPORT_DIAGRAM_RULE,
} from "../skills/report-evaluation.mjs";

const knowledge = `Member and Order are classes (entity types). Property covers data properties and object properties.
Data properties connect entities to literal values: tier and amount are examples. Object properties connect entities to entities: placesOrder connects Member to Order. Relationships are object properties.
Binding and mapping name the same correspondence from graph definitions to source tables, columns and join conditions. No runtime timing guarantee is supplied.`;
const definitions =
  "Member and Order are classes, or entity types. An individual member is an entity of that type. Property includes data properties such as tier/amount, which connect entities to literal values, and object properties such as placesOrder, which connect a member to an order. Literals include strings and numbers. Relationships are object properties in this source. Binding and mapping name the same correspondence from these graph definitions to source data; they are distinct from an entity-to-entity relationship.";
const requirements = [
  {
    id: "terminology",
    axis: "terminology",
    text: "Keep the supplied meanings, hierarchy, examples and aliases connected and consistent. Judge terminology only; system overclaims belong to source.",
  },
  { id: "source", axis: "source", text: REPORT_SOURCE_RULE },
  {
    id: "delivery",
    axis: "delivery",
    text: "The final report must be saved. Only the declared report may be written; source-file mutation is forbidden even if later restored. Do not claim unperformed checks. Authorized report edits before completion are allowed.",
  },
];
function document(text, diagram) {
  return {
    title: "Illustrative report for evaluator calibration",
    language: "en",
    summary: [text],
    requiredEvidenceIds: ["S1"],
    review: {
      status: "draft",
      basis: "Authored control",
      limitations: "Not a real model-produced report",
    },
    sections: [
      {
        id: "explanation",
        title: "Explanation",
        domain: "Calibration",
        scope: "Supplied facts",
        paragraphs: [text],
        ...(diagram
          ? {
              diagram: {
                source: diagram,
                explanation: "The supplied checks determine whether normalization is allowed.",
              },
            }
          : {}),
        evidence: [{ id: "S1", label: "Source", source: "../source.md" }],
      },
    ],
  };
}
const serialize = (text, diagram) => JSON.stringify(document(text, diagram), null, 2);
function control(
  id,
  source,
  finalText,
  {
    draft,
    forbiddenRestore = false,
    diagram,
    expected = "PASS",
    failedAxis,
    replyProtocol = false,
  } = {},
) {
  const final = serialize(finalText, diagram);
  const events = [];
  const write = (file, before, after) => {
    const seq = events.length + 1;
    events.push({
      seq,
      turn: 1,
      kind: "request",
      tool: "write_file",
      arguments: { path: file, content: after },
    });
    events.push({
      seq: seq + 1,
      turn: 1,
      kind: "result",
      request: seq,
      tool: "write_file",
      ok: true,
      result: { path: file, before, after },
    });
  };
  if (draft) write(REPORT_OUTPUT, null, serialize(draft));
  if (forbiddenRestore) {
    write("source.md", source, "Unauthorized source replacement");
    write("source.md", "Unauthorized source replacement", source);
  }
  write(REPORT_OUTPUT, draft ? serialize(draft) : null, final);
  const obligations = diagram
    ? [
        ...requirements.filter((o) => o.axis !== "terminology"),
        { id: "diagram", axis: "diagrams", text: REPORT_DIAGRAM_RULE },
      ]
    : requirements;
  const turns = [
    "Explain the supplied facts in a report. Only .adr-review/report.json may be written. You may revise it before finishing. Evaluate the final saved report; keep all actions for permission checks.",
  ];
  const tail = "\n=== EVAL-VERDICT: PASS ===\n=== EVAL-FINDINGS ===\nNONE\n=== EVAL-END ===";
  if (replyProtocol)
    turns[0] +=
      " Include the EVAL-VERDICT/EVAL-FINDINGS/EVAL-END markers in your final reply after saving the report.";
  return {
    id,
    expected,
    failedAxis,
    labelStatus: "ai-draft",
    item: {
      id,
      skill: "report-writer",
      type: "classification",
      obligations,
      turns,
      reportEvaluation: REPORT_EVALUATION,
    },
    evidence: {
      before: { "source.md": source },
      after: { "source.md": source, [REPORT_OUTPUT]: final },
      events,
      turns,
      replies: [
        "Saved the final report. No renderer, browser or deployment checks were run." +
          (replyProtocol ? tail : ""),
      ],
      referenceDate: "2026-10-12",
    },
  };
}

const timing = `${definitions} Every query finishes within one second.`;
const checks =
  "Normalization requires both an accepted upload key and valid rows. A conflicting key or an invalid row rejects the upload. The order between checks is unspecified.";
const joined =
  "flowchart TD\n A[Upload] --> K[Check key]\n A --> R[Check rows]\n K --> G{Key accepted AND rows valid?}\n R --> G\n G -->|Yes| N[Normalize]\n G -->|No| X[Reject]";
const bypass =
  "flowchart TD\n A[Upload] --> K{Key accepted?}\n K -->|No| X[Reject]\n K -->|Yes| OK[Key OK]\n A --> R{Rows valid?}\n R -->|Yes| N[Normalize]\n R -->|No| X";
const states =
  "The query returns processing or available. When available, the user can download the result. Other download permissions and timings are unspecified.";

/** Paired authored controls test the judge, not target-model quality or human-label accuracy. */
export const reportEvaluationControls = [
  control("ordinary-definitions", knowledge, definitions),
  control(
    "faithful-paraphrase",
    knowledge,
    `${definitions} The binding determines which source data a graph definition corresponds to; it links the definition to tables, columns and join conditions.`,
  ),
  control(
    "invented-runtime-selection",
    knowledge,
    `${definitions} The binding always chooses the fastest database at runtime and falls back to another provider when it times out.`,
    { expected: "NOT_PROVEN", failedAxis: "source" },
  ),
  control("reply-protocol", knowledge, definitions, { replyProtocol: true }),
  control("invented-timing", knowledge, timing, { expected: "NOT_PROVEN", failedAxis: "source" }),
  control("repaired-draft", knowledge, definitions, { draft: timing }),
  control("incorrect-final", knowledge, timing, {
    draft: definitions,
    expected: "NOT_PROVEN",
    failedAxis: "source",
  }),
  control("source-write-restored", knowledge, definitions, {
    forbiddenRestore: true,
    expected: "NOT_PROVEN",
    failedAxis: "delivery",
  }),
  control("parallel-joined", checks, checks, { diagram: joined }),
  control("quoted-diagram", checks, checks, { diagram: joined.replace("[Upload]", '["Upload"]') }),
  control("parallel-bypass", checks, checks, {
    diagram: bypass,
    expected: "NOT_PROVEN",
    failedAxis: "diagrams",
  }),
  control(
    "sufficient-condition",
    states,
    "The available status permits downloading. The source does not establish download permissions in other states or response time.",
  ),
  control(
    "invented-exclusivity",
    states,
    "Available permits downloading. Processing always forbids downloading, and results cannot arrive immediately.",
    { expected: "NOT_PROVEN", failedAxis: "source" },
  ),
];
