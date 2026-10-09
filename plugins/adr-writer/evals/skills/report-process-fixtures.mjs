/** Fixed hypothetical process specifications; no live results or output exemplars. */
const shared = [
  {
    id: "whole",
    text: "The report first gives a coherent whole-process view answering the reader question before internal detail. Its essential responsibilities and their connections are understandable. Honor the task-specific diagram request or exclusion and keep material limits visible in the overview.",
  },
  {
    id: "descent",
    text: "The report opens the same material responsibilities introduced above into their internal mechanism, not just repeated conclusions, peer examples, a file list or extra headings. Each nontrivial descent explains newly visible steps, participants, decisions or state relationships and how they produce the parent result. Depth is proportional to the evidence; do not require unsupported internals or a fixed level count.",
  },
  {
    id: "trace",
    text: "Where source evidence supports it, the concrete explanation traces an input or condition through a rule/decision to an observable outcome, including the important exception. Connect it back to the parent responsibility and neighboring stages. When source evidence does not support this detail, explicitly preserve that limit instead of inventing a worked mechanism.",
  },
  {
    id: "complete",
    text: "All material source responsibilities and conclusion-changing exact rules are explained in the report at an appropriate level, with their causal or dependency connections. Preserve values, units, ordering, permissions and failure guarantees. Each claim must stay within the supplied source; no invented measurements or guarantees.",
  },
  {
    id: "self-contained",
    text: "The intended reader can understand the process, the reasons for its key rules, and its limits without opening source links or earlier conversation. Introduce necessary project-specific terms before relying on them. Citations alone cannot replace explanation.",
  },
  {
    id: "restraint",
    text: "Honor Korean report delivery and the stated scope. Do not include quizzes. Do not force diagrams into simple facts or manufacture internal structure to fill a depth quota. Keep source gaps and known uncertainty honest. A different valid outline or diagram type is acceptable when the task permits it.",
  },
];
export const reportProcessFixtures = [
  {
    id: "catalog-publication",
    title: "상품 목록 반영과 게시",
    facts: `This is a hypothetical product process specification, not a deployed system observation.
An operator uploads a UTF-8 CSV of product rows to update a public catalog. A reviewer authorizes what becomes visible to customers.
1. Intake and validation: maximum size is 20 MiB. Each row requires product_id and price_krw. Prices are exact nonnegative whole Korean won. Any malformed row rejects the complete upload before catalog changes. The operator receives row-specific reasons.
An upload key identifies one submission. The same key and identical bytes returns the existing submission result. The same key with different bytes is rejected.
2. Normalization and preview: trim leading/trailing spaces from product_id; preserve case. After normalization, duplicate product IDs with identical prices collapse into one row; conflicting prices for one ID reject the entire batch. Compare against the currently published catalog and show counts of added, changed and unchanged rows. Unchanged rows have no write effect. Produce an immutable candidate revision.
3. Review and publication: the reviewer approves one exact candidate revision. Editing the candidate requires a new revision and new approval. Publication first durably stores the approved revision and then atomically changes the public revision pointer. If storing the revision or switching the pointer fails, readers keep the old published revision. A successful pointer change makes the whole new revision visible together.
4. Follow-up and recovery: emit a notification after publication, using the published revision as its deduplication key. Notification failures can retry notification but must not rerun publication. An explicit rollback switches the pointer to a previously published durable revision; it does not mutate that revision.
Illustrative inputs available: product_id ' A1 ' at price_krw 100 and 'A1' at 100 collapse into one row; 'A1' at 100 and 'A1' at 120 conflict. These are examples, not measurements. No notification delivery latency, maximum retry count, reviewer hierarchy, or deployed-system test has been supplied.`,
    request:
      "상품 CSV를 올린 뒤 고객에게 새 목록이 보이고 실패하면 복구하는 전체 과정을 주니어 개발자에게 설명해줘. 먼저 전체 프로세스를 Mermaid로 그리고, 그 안의 각 책임을 확대하면서 내부 동작과 중요한 조건을 이해할 수 있게 탑다운 리포트로 작성해줘.",
  },
  {
    id: "evaluation-pipeline",
    title: "LLM 평가의 실행·판정·집계",
    facts: `This is a hypothetical LLM evaluation process specification. Numerical data below are fixed example inputs, not results of the current experiment.
A team compares two writing instructions on an unchanged case corpus.
1. Prepare: freeze case IDs, source facts, user requests, expected obligations, model settings and repeat count before execution. Instruction variants receive identical task data. Trial order alternates between variants. Do not change expected obligations after seeing results.
2. Execute and capture: each trial starts in a separate workspace with read-only facts and instruction files. Only its declared report output is writable. Capture the exact produced document, provider response, timing and reported token usage. A timeout, denied provider request or missing required document is an execution error, not a successful task or semantic FAIL. Keep the error and its trial ID.
3. Judge: a separate model judges the final document against every frozen obligation using the source facts, without seeing the variant name or proposed improvement. Each obligation is PASS, FAIL or UNVERIFIED. PASS/FAIL must cite a short exact quote from the final document or source. A missing supporting explanation is UNVERIFIED; a contradicted rule is FAIL. Overall semantic PASS requires every obligation to PASS. Invalid judge JSON or an unsupported quote is a judging error. One citation-format repair against identical evidence is allowed; it cannot change the criteria or erase a real failure. Preserve both attempts.
4. Summarize: keep requested trials, valid judgments, semantic failures/unverified and execution/judge errors distinct. Calculate semantic pass rate among valid judgments and show the denominator and excluded errors. Example: 10 requested trials, 8 valid judgments, 6 semantic PASS, 2 NOT_PROVEN, and 2 provider errors gives 6/8 = 75% among valid judgments; it is not 75% of all requests. Count all requested trials and errors alongside the rate.
Compare variants only on valid pairs sharing case, repeat and fixed settings; missing partners do not count as improvement. Report model identities actually returned. A requested alias alone does not prove the underlying model revision and cannot justify a causal lift claim. Unknown provider cost remains unpriced, not zero.
The output is a report retaining all trial evidence. A passing structure validator is not semantic correctness or measured reader learning. No deployment or reader study was performed.`,
    request:
      "LLM 지침 두 버전을 비교할 때 준비부터 실행, 판정, 집계까지 어떻게 이어지는지 설명해줘. 전체 프로세스의 Mermaid 그림에서 시작해서 각 책임의 내부를 확대하고, 숫자가 어떤 판정을 거쳐 결과표에 들어가는지 구체적으로 이해할 수 있는 탑다운 리포트를 작성해줘.",
  },
  {
    id: "limited-evidence",
    title: "근거가 제한된 문서 처리 과정",
    facts: `Only these facts are known about a hypothetical document service: A user submits a document and receives a job identifier. Later the user can query that identifier. The query may return 'processing' or 'available'. When available, the user can download the result. The internal processing stages, storage layout, status transition ordering, retry behavior, authorization model, supported file types, limits, timings and output transformation are not supplied. There is no source evidence for decomposing the service's internal processing further. No live inspection or measured performance exists.`,
    request:
      "문서를 보내고 결과를 받는 전체 과정을 탑다운으로 설명해줘. 이번 보고서는 글로만 작성하고 Mermaid나 다른 그림은 넣지 마. 내부 자료가 없는 부분은 그 한계까지 알 수 있게 설명해줘.",
  },
].map((c) => ({ ...c, obligations: shared }));
