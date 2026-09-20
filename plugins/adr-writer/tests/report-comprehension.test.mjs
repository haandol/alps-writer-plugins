import assert from "node:assert/strict";
import test from "node:test";
import {
  renderHtml,
  renderMarkdown,
  validateReport,
} from "../skills/report-write/scripts/render-report.mjs";
import { installQuiz, quizLabels } from "../skills/report-write/scripts/comprehension.mjs";

const question = (index = 1, sectionId = "retries") => ({
  id: `Q${index}`,
  sectionId,
  question: "A completed payment request is retried with the same key. Which result follows?",
  options: [
    { id: "A", text: "Charge again.", feedback: "A completed key already has a result." },
    {
      id: "B",
      text: "Return the stored result.",
      feedback: "The stored completion identifies the same payment.",
    },
    {
      id: "C",
      text: "Delete the completion.",
      feedback: "Deleting completion would lose the retry boundary.",
    },
    {
      id: "D",
      text: "Always report failure.",
      feedback: "The successful completion remains available.",
    },
  ],
  correctOptionId: "B",
  explanation: "A completed key reuses its stored result so the retry does not charge again.",
  evidence: "The Retry behavior paragraph says completed keys return their stored result.",
  revisit: index === 1,
});
const report = () => ({
  title: "Retry behavior",
  language: "en",
  summary: [
    "Completed payment requests return their stored result when retried with the same key.",
  ],
  sections: [
    {
      id: "retries",
      title: "Retry behavior",
      domain: "Payments",
      scope: "Completed requests",
      paragraphs: ["A completed key returns its stored result without another charge."],
    },
    {
      id: "limits",
      title: "Limits",
      domain: "Payments",
      scope: "Incomplete requests",
      paragraphs: ["An incomplete request does not have a stored completion."],
    },
  ],
  requiredEvidenceIds: [],
  review: { status: "reviewed", basis: "Synthetic test example.", limitations: "" },
  comprehensionCheck: { questions: [question()] },
});

test("a report carries one or five questions under their actual explanation without losing answers", () => {
  const doc = report();
  assert.equal(validateReport(doc).nodes, 2);
  doc.comprehensionCheck.questions = Array.from({ length: 5 }, (_, i) =>
    question(i + 1, i < 3 ? "retries" : "limits"),
  );
  const html = renderHtml(doc);
  assert.equal((html.match(/<article class="quiz">/g) || []).length, 5);
  assert.ok(html.indexOf("Q3") < html.indexOf('id="limits"'));
  assert.ok(html.indexOf("Q4") > html.indexOf('id="limits"'));
  const markdown = renderMarkdown(doc);
  assert.ok(markdown.indexOf("**Q3.") < markdown.indexOf("Answers and explanations"));
  assert.ok(markdown.includes(doc.comprehensionCheck.questions[0].explanation));
  assert.ok(markdown.includes(doc.comprehensionCheck.questions[0].options[0].feedback));
});

test("question caps, distinct choices, one answer, evidence and revisit boundaries reject invalid reports", () => {
  for (const [mutate, error] of [
    [
      (d) => {
        d.comprehensionCheck.questions = [];
      },
      /1 to 5/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions = Array.from({ length: 6 }, (_, i) => question(i + 1));
      },
      /1 to 5/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions[0].options.pop();
      },
      /exactly 4/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions[0].options[1].text = " charge AGAIN. ";
      },
      /duplicate/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions[0].correctOptionId = ["A", "B"];
      },
      /non-empty string/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions[0].correctOptionId = "E";
      },
      /four choices/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions[0].evidence = "";
      },
      /evidence/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions[0].revisit = false;
      },
      /1 or 2/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions = [1, 2, 3].map((i) => ({ ...question(i), revisit: true }));
      },
      /1 or 2/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions[0].sectionId = "absent";
      },
      /sectionId/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions = Array.from({ length: 5 }, (_, i) => question(i + 1));
      },
      /four peer/,
    ],
    [
      (d) => {
        d.comprehensionCheck.questions[0].answerLeak = "B";
      },
      /would be lost/,
    ],
  ]) {
    const doc = report();
    mutate(doc);
    assert.throws(() => renderHtml(doc), error);
  }
  const noQuiz = report();
  delete noQuiz.comprehensionCheck;
  assert.doesNotThrow(
    () => renderHtml(noQuiz),
    "legacy and explicitly omitted quizzes remain readable",
  );
});

test("HTML keeps answer data out of visible markup and escapes authored question text", () => {
  const doc = report();
  doc.language = "ko";
  const q = doc.comprehensionCheck.questions[0];
  q.question = '<img src=x onerror="alert(1)"> 재시도 결과는?';
  q.options[1].text = "</script><script>alert(1)</script>";
  q.explanation = "비공개 해설 </script>";
  q.evidence = "비공개 근거";
  const html = renderHtml(doc);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img src=x|<script>alert|비공개 해설|비공개 근거/);
  assert.match(html, /class="quiz__options"[^>]*hidden/);
  assert.match(html, /class="quiz__feedback"[^>]*hidden/);
  assert.match(html, /선택지 보기/);
  assert.match(html, /@media print/);
  assert.doesNotMatch(html, /localStorage|sessionStorage|fetch\(/);
});

/** Minimal event-capable DOM boundary for exercising the shipped browser controller. */
function quizDom(q) {
  const element = (hidden = false) => ({
    hidden,
    textContent: "",
    dataset: {},
    events: {},
    addEventListener(event, handler) {
      this.events[event] = handler;
    },
    setAttribute() {},
    focus() {},
  });
  const selectors = [
    ".quiz__reveal",
    ".quiz__options",
    ".quiz__check",
    ".quiz__required",
    ".quiz__feedback",
    ".quiz__teach-back",
    ".quiz__result",
    ".quiz__answer",
    ".quiz__selected-feedback",
    ".quiz__criteria",
    ".quiz__evidence",
  ];
  const elements = Object.fromEntries(
    selectors.map((s) => [s, element(![".quiz__reveal"].includes(s))]),
  );
  const inputs = q.options.map((o) => ({ ...element(), value: o.id, checked: false }));
  elements[".quiz__check"].dataset = {
    correct: q.correctOptionId,
    answer: Buffer.from(q.options[1].text).toString("base64"),
    feedback: Buffer.from(
      JSON.stringify(Object.fromEntries(q.options.map((o) => [o.id, o.feedback]))),
    ).toString("base64"),
    explanation: Buffer.from(q.explanation).toString("base64"),
    evidence: Buffer.from(q.evidence).toString("base64"),
  };
  elements[".quiz__feedback"].querySelectorAll = () => selectors.slice(6).map((s) => elements[s]);
  const card = {
    querySelector: (s) => (s === 'input[type="radio"]' ? inputs[0] : elements[s]),
    querySelectorAll: (s) => (s.endsWith(":checked") ? inputs.filter((i) => i.checked) : inputs),
  };
  return { card, elements, inputs };
}

test("self-check requires revealed choices and exactly one answer, resets feedback, and isolates questions", () => {
  const first = quizDom(question()),
    second = quizDom(question(2));
  installQuiz({ querySelectorAll: () => [first.card, second.card] }, quizLabels.en);
  const { elements: el, inputs } = first;
  const click = (key) => el[key].events.click();
  click(".quiz__check");
  assert.equal(el[".quiz__feedback"].hidden, true);
  click(".quiz__reveal");
  assert.equal(el[".quiz__options"].hidden, false);
  click(".quiz__check");
  assert.equal(el[".quiz__required"].hidden, false);
  inputs[0].checked = true;
  inputs[0].events.change();
  assert.equal(el[".quiz__teach-back"].hidden, false);
  assert.equal(el[".quiz__feedback"].hidden, true);
  click(".quiz__check");
  assert.equal(el[".quiz__result"].textContent, "Review this concept");
  assert.match(el[".quiz__answer"].textContent, /B\. Return the stored result/);
  assert.equal(el[".quiz__evidence"].textContent, question().evidence);
  inputs[0].checked = false;
  inputs[1].checked = true;
  inputs[1].events.change();
  assert.equal(el[".quiz__feedback"].hidden, true);
  assert.equal(el[".quiz__criteria"].textContent, "");
  click(".quiz__check");
  assert.equal(el[".quiz__result"].textContent, "Correct");
  assert.equal(second.elements[".quiz__options"].hidden, true);
  assert.equal(second.elements[".quiz__feedback"].hidden, true);
  inputs[2].checked = true;
  click(".quiz__check");
  assert.equal(el[".quiz__feedback"].hidden, true);
});
