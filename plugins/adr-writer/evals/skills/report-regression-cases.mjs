/** Cross-domain controls keep path review from becoming a rule to split every error. */
export const reportRegressionCases = [
  {
    id: "report-diagram-notation-freedom",
    title: "Choose diagram notation by the relationship, without a flowchart default",
    source: `Synthetic domain model: Duck inherits Animal. Owner owns Pet by composition.
A submitted task can move from Pending to Running, then either Done or Failed; Done and Failed are terminal.
The report renderer uses the bundled official Mermaid parser and browser engine. No separate type allowlist exists.`,
    task: "In Korean chat only, provide the Mermaid views you judge appropriate to explain the two subjects and briefly explain the choice. Preserve the stated relationship semantics. Do not invoke tools, write files, add a quiz, or claim rendering was executed.",
    semanticObligations: [
      {
        id: "notation-semantics",
        text: "Express inheritance and composition distinctly with appropriate UML class notation (such as classDiagram with inheritance and composition arrows), not generic flowchart boxes/arrows. Express the task lifecycle clearly, preserving both terminal outcomes. A state diagram is appropriate without having to justify why sequence or component views are insufficient; an equally faithful lifecycle view is acceptable. Do not force a fixed combination or diagram count.",
      },
      {
        id: "freedom-and-evidence",
        text: "Do not invent a four-type allowlist, claim class diagrams unsupported, prefer flowchart merely for renderer convenience, or claim actual rendering/verification without execution. Keep invented relations out, while honoring the chat-only delivery.",
      },
    ],
  },
  {
    id: "report-regression-timeout-artifact-review",
    title: "A saved artifact does not erase a timeout or prove no document was produced",
    source: `Supplied recorded evaluation ledger (fixture data):
Four requested trial IDs use identical first-submission rules. Completing the target call within its deadline, native format validity, and semantic PASS are independent requirements for an on-time successful task.
T1: target returned before deadline; saved document is format-valid; semantic PASS.
T2: target timed out; a document had already been written and was recovered unchanged after the timeout. Offline native validation passed and offline semantic judgment is PASS. No second target attempt occurred.
T3: target returned before deadline; saved document is format-invalid; semantic PASS.
T4: target returned before deadline; saved document is format-valid; semantic UNVERIFIED.
All four saved documents received valid semantic judgments. No transport or judge error other than the T2 target timeout occurred. A recovered document and its assessment retain T2's original trial ID and timeout record.`,
    task: `Review these claims in Korean without rewriting the reports. Explain what each recorded result establishes and give the correct counts. No tools, files or quiz.
Claim A: "T2 timed out, so no document exists and no content judgment is possible."
Claim B: "T2's recovered document passed offline checks, so the original target call completed successfully; remove its timeout and count the recovery as a fifth trial."
Claim C: "Three of four semantic judgments passed, so three tasks completed on time with valid documents."
Claim D: "There are four saved documents and four valid semantic judgments, with 3/4 semantic PASS. Three target calls returned on time, and only T1 satisfies all three task requirements. T2's document assessment is useful but its original timeout remains."`,
    semanticObligations: [
      {
        id: "timeout-and-artifact",
        text: "Reject both A and B: T2 has an unchanged saved document with useful offline validation and semantic PASS, but still has a target timeout. Do not infer artifact absence from timeout, erase or relabel the timeout, invent a second target call, count a fifth trial, or confuse offline judgment with on-time invocation completion.",
      },
      {
        id: "intersection-and-control",
        text: "Reject C and accept D using the actual trial intersection. Four requested IDs, three on-time returns, four saved documents, three format-valid documents, four valid judgments with three semantic PASS and one UNVERIFIED, and one on-time successful task (T1) are distinct counts. Attribute 3/4 = 75% to semantic PASS only; an exact fraction or equivalent percentage is sufficient and both notations are not required. T2 fails timeliness, T3 format and T4 semantics. Preserve the three task requirements accurately throughout. Stay review-only and preserve all records.",
      },
    ],
  },
  {
    id: "report-regression-shared-recovery-control",
    title: "Shared recovery is valid only for conditions with the same permission",
    source: `Supplied hypothetical archive import policy:
An import can complete, lose its connection, encounter temporary storage unavailability, or be denied access.
Connection loss and temporary storage unavailability each permit one retry of the same import. Access denial is terminal and must be returned without retry.
The retry count is at most one per import. No other recovery action is specified.`,
    task: `Review the two diagrams in Korean prose only. Explain supported and unsupported paths and the reader impact. Do not redraw, invoke tools, write files or add a quiz.
Diagram A:
flowchart TD
 A[Import] --> B{Outcome}
 B -->|connection lost| T[Temporary failure]
 B -->|storage unavailable| T
 T --> R[Retry same import once]
 B -->|access denied| D[Return denial]
 B -->|complete| S[Return result]
Diagram B:
flowchart TD
 A[Import] --> B{Connected AND authorized}
 B -->|yes| S[Continue import]
 B -->|no| T[Temporary failure]
 T --> R[Retry same import once]
Its prose says: Access denial is terminal.`,
    semanticObligations: [
      {
        id: "valid-merge",
        text: "Recognize that A may merge connection loss and storage unavailability because both have the same one-retry permission. Do not invent a general rule that every error needs a separate node. Access denial remains outside that action.",
      },
      {
        id: "boolean-path",
        text: "Trace B's false Connected AND authorized branch: an unauthorized request with a working connection reaches retry. Identify the unsupported denial retry even though the prose calls denial terminal. Explain the reader action and propose narrowing the path without redrawing or asserting facts about unspecified connected/authorized work.",
      },
    ],
  },
  {
    id: "report-regression-notification-authoring",
    title: "Authoring transfers recovery boundaries to a different process",
    source: `Supplied hypothetical membership publication policy:
A reviewer approves an immutable membership revision. The system first stores it durably, then atomically changes the public revision pointer. A failure before the pointer changes leaves the old revision visible.
After publication the system sends a notification, deduplicated by the published revision. A notification failure permits retrying that notification only; it must not repeat publication or revoke the published revision.
The notification retry count and delivery latency are not specified. No live test was performed.`,
    task: "Write a Korean top-down explanation with an overview Mermaid diagram and a detailed view of publication and notification failure. Explain the action a caller can take after each known failure. Use only these facts. No tools, file writes or quiz.",
    semanticObligations: [
      {
        id: "failure-destination",
        text: "Prose and every diagram keep notification failure after successful publication. Its retry goes only to notification, never through storing, pointer switching, new approval or rollback. Do not infer that notification failure hides the already published revision. Unknown retry count and latency remain unknown.",
      },
      {
        id: "ordering-and-descent",
        text: "The overview and its deeper explanation preserve exact-revision approval, durable storage before atomic pointer change, the old revision on pre-switch failure and revision-key notification deduplication. The detailed view opens the same publication/notification responsibilities and explains their distinct observable outcomes rather than repeating headings or inventing a general transaction rollback.",
      },
    ],
  },
  {
    id: "report-regression-accounting-review",
    title: "Review separates first artifacts, recovered attempts and semantic denominators",
    source: `Supplied recorded evaluation ledger (fixture data, not this test's measurements):
There are 10 requested trial IDs. Eight target calls returned; two timed out. Of the eight returned documents, three passed initial format validation and five failed it.
All eight saved documents, including format-invalid ones, received valid semantic judgments: six PASS, one FAIL and one UNVERIFIED.
One of the five initially invalid documents was later repaired and passed format validation. It keeps its original trial ID and first document. All other documents remain unchanged. No semantic re-judgment of that repair was performed.
Four eligible paired trial IDs compare the same settings; there is no verified underlying model identity for the requested model alias. Target-reported cost totals USD 0.48; judge calls have no price record.`,
    task: `Review this paragraph in Korean without editing it. Explain each unsupported conclusion and the correct denominators. No tools, files or quiz.
"수리 후 첫 형식 통과는 4/10이다. 내용 PASS가 6개이므로 작업 6개가 최종 성공했다. 잘못된 형식은 의미 평가에서 제외했으므로 6/3 = 200%다. 두 timeout은 기록에서 빼면 된다. 수리본도 새 성공 시행으로 센다. 같은 모델 별칭이니 네 쌍의 개선이 모델 차이와 무관함을 입증했다. 총비용은 0.48달러이고 판정 비용은 0이다."
Also review this separate calculation on its own merits:
"최초 시행 ID의 최종 결과는 유효 판정 8개와 timeout 2개로 전체 10개를 빠짐없이 나눈다. 따라서 최종 판정 오류로 끝난 시행은 10 - 8 - 2 = 0개다. 중간 판정 호출의 오류 횟수나 나중 수리본의 의미 평가는 이 계산으로 알 수 없다."`,
    semanticObligations: [
      {
        id: "separate-denominators",
        text: "Keep 10 requested and 2 timeouts visible; initial native format is 3/8 returned documents (or 3/10 requested with explicit label), never relabel the repaired fourth document as an initial pass. Semantic PASS is 6/8 = 75% valid judgments, with FAIL and UNVERIFIED distinct, since invalid-format documents were also judged. Do not infer end-to-end success without the per-trial intersection of format and semantic results.",
      },
      {
        id: "repair-and-identity",
        text: "The repaired document retains one trial ID and both versions; it is not an extra trial or proof of post-repair semantic PASS. Four eligible pairs without verified underlying model identity do not establish a causal instruction lift free of model differences. The USD 0.48 is target-reported only; missing judge price is unknown, not zero. Stay review-only.",
      },
      {
        id: "derived-zero",
        text: "Accept the separate calculation of zero terminal judge-error trials from the complete mutually exclusive initial trial outcomes: 10 minus 8 valid judgments minus 2 timeouts equals zero. Do not call every derived zero a fabricated missing value. Keep that result distinct from unpriced judge cost and unknown intermediate judge-call errors; neither is proven zero.",
      },
    ],
  },
  {
    id: "report-regression-artifact-evidence-review",
    title: "Review distinguishes source ID coverage, resolution and supported renderer syntax",
    source: `Supplied local report fixture:
The delivered file is /fixture/review/report.html. The only original is /fixture/source.md and it contains a section titled Publication, but no explicit fragment anchor.
Document A declares requiredEvidenceIds ["S1"] and has exactly one evidence item {id:"S1", label:"Publication", source:"../source.md"}.
Document B declares requiredEvidenceIds [] and has evidence {id:"S1", label:"Publication", source:"source.md (Publication)"}.
Both documents' prose accurately quotes the supplied original. A completed native renderer run accepted A's JSON and rendered all included diagrams; it rejected B for evidence inventory mismatch before rendering. Another Mermaid implementation accepted B's separate diagram source, while the native parser reported it unsupported. No browser or print checks ran.`,
    task: "Review the delivery claims 'A has proven semantic correctness, all browser checks passed; B has no issue because its prose is accurate and another Mermaid tool accepted it' in Korean. Explain the exact correction and what remains unverified without rewriting the documents. No tools, files or quiz.",
    semanticObligations: [
      {
        id: "independent-evidence-checks",
        text: "Recognize A's complete ID inventory and resolvable ../source.md target, but do not treat native rendering as semantic, browser or print proof. For B identify both the empty inventory versus actual S1 mismatch and the nonresolving description-in-path; put Publication in the label and target the supplied original. Do not recommend deleting evidence to satisfy the inventory.",
      },
      {
        id: "parser-scope",
        text: "Separate compatibility with the recorded native Mermaid version from validity in another renderer. Report B's actual native failure without claiming universal Mermaid invalidity. Suggest a supported representation or explicitly labeled fallback consistent with the document contract, not silently dropping relationships or calling an unrendered diagram rendered. Remain review-only.",
      },
    ],
  },
];
