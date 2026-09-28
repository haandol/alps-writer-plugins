/** Shared, dependency-free comprehension checks for report authors and renderers. */
const text = (value) => typeof value === "string" && value.trim().length > 0;
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const encoded = (value) => Buffer.from(value, "utf8").toString("base64");

/**
 * Reject incomplete or ambiguous quiz data before rendering. Section ownership is
 * checked by the report adapter; question count and answer shape are shared.
 */
export function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 5)
    throw new Error("comprehensionCheck.questions must contain 1 to 5 questions");
  let revisitCount = 0;
  for (const [index, question] of questions.entries()) {
    const name = `comprehensionCheck.questions[${index}]`;
    if (!question || typeof question !== "object" || Array.isArray(question))
      throw new Error(`${name} must be an object`);
    if (question.id !== `Q${index + 1}`) throw new Error(`${name}.id must be Q${index + 1}`);
    for (const field of ["question", "correctOptionId", "explanation", "evidence"])
      if (!text(question[field])) throw new Error(`${name}.${field} must be a non-empty string`);
    if (typeof question.revisit !== "boolean") throw new Error(`${name}.revisit must be a boolean`);
    if (question.revisit) revisitCount++;
    if (!Array.isArray(question.options) || question.options.length !== 4)
      throw new Error(`${name}.options must contain exactly 4 choices`);
    const choices = new Set();
    question.options.forEach((option, optionIndex) => {
      const expected = String.fromCharCode(65 + optionIndex);
      if (!option || option.id !== expected)
        throw new Error(`${name}.options[${optionIndex}].id must be ${expected}`);
      for (const field of ["text", "feedback"])
        if (!text(option[field]))
          throw new Error(`${name}.options[${optionIndex}].${field} must be a non-empty string`);
      const normalized = option.text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
      if (choices.has(normalized)) throw new Error(`${name} contains duplicate option text`);
      choices.add(normalized);
    });
    if (!question.options.some((option) => option.id === question.correctOptionId))
      throw new Error(`${name}.correctOptionId must reference one of its four choices`);
  }
  if (revisitCount < 1 || revisitCount > 2)
    throw new Error("comprehensionCheck must mark 1 or 2 questions with revisit: true");
}

export const quizLabels = {
  en: {
    comprehension: "Check your understanding",
    recallCue: "Recall your answer before viewing the choices.",
    showChoices: "Show choices",
    teachBackCue:
      "Before checking, explain your choice in one sentence. Nothing is recorded or graded.",
    revisitBadge: "revisit later",
    revisitGuidance:
      "Reopen this report and retry this core question later. No schedule or progress is stored.",
    selfCheck: "Check selection",
    answerRequired: "Select one choice first.",
    correct: "Correct",
    needsReview: "Review this concept",
    correctChoice: "Correct answer",
    selectedFeedback: "Selection feedback",
    answerCriteria: "Why the correct choice fits",
    gradingEvidence: "Evidence",
    selfCheckLimit:
      "This supports understanding; it does not measure learning or change the report's conclusion.",
    answers: "Answers and explanations — read after choosing",
  },
  ko: {
    comprehension: "이해도 확인",
    recallCue: "선택지를 보기 전에 답을 떠올려 보세요.",
    showChoices: "선택지 보기",
    teachBackCue:
      "확인하기 전에 선택 이유를 한 문장으로 설명해 보세요. 입력하거나 채점하지 않습니다.",
    revisitBadge: "후속 재점검",
    revisitGuidance:
      "나중에 이 보고서를 다시 열어 이 핵심 질문을 풀어보세요. 시간과 진행 상태는 저장하지 않습니다.",
    selfCheck: "선택 확인",
    answerRequired: "먼저 선택지 하나를 고르세요.",
    correct: "정답",
    needsReview: "다시 확인 필요",
    correctChoice: "정답 선택지",
    selectedFeedback: "선택한 답의 설명",
    answerCriteria: "정답이 맞는 이유",
    gradingEvidence: "근거",
    selfCheckLimit:
      "이해를 돕기 위한 자가 확인입니다. 학습 효과를 측정하거나 보고서의 판정을 바꾸지 않습니다.",
    answers: "정답과 해설 — 답을 고른 뒤 확인하세요",
  },
};

/** Render one question without visible answers; encoded data is disclosure, not secrecy. */
export function renderQuestion(question, index, ui = quizLabels.en) {
  return `<article class="quiz">
<div class="quiz__head"><span class="quiz__id">${esc(question.id)}</span>${question.revisit ? `<span class="quiz__revisit">${esc(ui.revisitBadge)}</span>` : ""}</div>
<p class="quiz__question">${esc(question.question)}</p>
<p class="quiz__recall">${esc(ui.recallCue)}</p>
<button class="quiz__reveal" type="button" data-question-index="${index}" aria-expanded="false">${esc(ui.showChoices)}</button>
<div class="quiz__options" data-question-index="${index}" role="group" aria-label="${esc(question.question)}" hidden>${question.options.map((option) => `<label class="quiz__option"><input type="radio" name="quiz-${index}" value="${esc(option.id)}"><span><strong>${esc(option.id)}.</strong> ${esc(option.text)}</span></label>`).join("")}</div>
<p class="quiz__teach-back" data-question-index="${index}" hidden>${esc(ui.teachBackCue)}</p>
<button class="quiz__check" type="button" data-question-index="${index}" data-correct="${esc(question.correctOptionId)}" data-answer="${encoded(question.options.find((o) => o.id === question.correctOptionId)?.text || "")}" data-explanation="${encoded(question.explanation)}" data-evidence="${encoded(question.evidence)}" data-feedback="${encoded(JSON.stringify(Object.fromEntries(question.options.map((o) => [o.id, o.feedback]))))}" hidden>${esc(ui.selfCheck)}</button>
<p class="quiz__required" role="status" data-question-index="${index}" hidden>${esc(ui.answerRequired)}</p>
${question.revisit ? `<p class="quiz__revisit-guidance">${esc(ui.revisitGuidance)}</p>` : ""}
<div class="quiz__feedback" role="status" data-question-index="${index}" hidden><strong class="quiz__result"></strong><p class="quiz__answer"></p>
<strong>${esc(ui.selectedFeedback)}</strong><p class="quiz__selected-feedback"></p>
<strong>${esc(ui.answerCriteria)}</strong><p class="quiz__criteria"></p>
<strong>${esc(ui.gradingEvidence)}</strong><p class="quiz__evidence"></p><p class="quiz__limit">${esc(ui.selfCheckLimit)}</p></div>
</article>`;
}

/**
 * Wire recall, selection and explicit feedback in the browser. Every query stays
 * inside its question, and a changed answer clears prior feedback; nothing is persisted.
 */
export function installQuiz(document, ui) {
  const decode = (value) =>
    new TextDecoder().decode(Uint8Array.from(atob(value || ""), (c) => c.charCodeAt(0)));
  document.querySelectorAll(".quiz").forEach((card) => {
    const find = (selector) => card.querySelector(selector);
    const button = find(".quiz__reveal");
    const options = find(".quiz__options");
    const check = find(".quiz__check");
    const required = find(".quiz__required");
    const feedback = find(".quiz__feedback");
    const teachBack = find(".quiz__teach-back");
    button.addEventListener("click", () => {
      options.hidden = false;
      check.hidden = false;
      button.hidden = true;
      button.setAttribute("aria-expanded", "true");
      find('input[type="radio"]')?.focus();
    });
    card.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener("change", () => {
        teachBack.hidden = false;
        required.hidden = true;
        feedback.hidden = true;
        feedback.querySelectorAll("p:not(.quiz__limit),.quiz__result").forEach((n) => {
          n.textContent = "";
        });
      });
    });
    check.addEventListener("click", () => {
      const picked = [...card.querySelectorAll('input[type="radio"]:checked')];
      if (options.hidden || picked.length !== 1) {
        required.hidden = false;
        feedback.hidden = true;
        return;
      }
      required.hidden = true;
      const selected = picked[0].value;
      find(".quiz__result").textContent =
        selected === check.dataset.correct ? ui.correct : ui.needsReview;
      find(".quiz__answer").textContent =
        `${ui.correctChoice}: ${check.dataset.correct}. ${decode(check.dataset.answer)}`;
      find(".quiz__selected-feedback").textContent =
        JSON.parse(decode(check.dataset.feedback))[selected] || "";
      find(".quiz__criteria").textContent = decode(check.dataset.explanation);
      find(".quiz__evidence").textContent = decode(check.dataset.evidence);
      feedback.hidden = false;
    });
  });
}

/** Inline only trusted runtime code and escaped labels, keeping reports usable offline. */
export function quizScript(ui) {
  const labels = {
    correct: ui.correct,
    needsReview: ui.needsReview,
    correctChoice: ui.correctChoice,
  };
  return `(${installQuiz.toString()})(document,${JSON.stringify(labels).replace(/</g, "\\u003c")});`;
}

export const quizCss = `
.quiz{margin:22px 0;padding:18px;border:1px solid #cbd9e1;border-radius:7px;break-inside:avoid}
.quiz__head{display:flex;gap:16px;font-size:13px;color:#526f80}.quiz__question{font-weight:600}
.quiz__options{display:grid;gap:9px;margin:16px 0}.quiz__option{display:flex;gap:10px;align-items:baseline;padding:10px;border:1px solid #d6e1e9;border-radius:5px;overflow-wrap:anywhere}
.quiz__option:has(input:checked){background:#edf4f8}.quiz__option input{flex-shrink:0}
.quiz button{font:inherit;padding:7px 14px;border:1px solid #69899e;border-radius:5px;background:#f3f7fa;color:#19384c;cursor:pointer}
.quiz :focus-visible{outline:3px solid #2676a6;outline-offset:3px}
.quiz__recall,.quiz__teach-back,.quiz__revisit-guidance,.quiz__limit{font-size:14px;color:#526f80}
.quiz__feedback{margin-top:16px;border-left:3px solid #69899e;padding-left:15px}
.quiz__feedback strong{display:block}.quiz__required{color:#80551d}.quiz [hidden]{display:none!important}
@media print{
.quiz__options,.quiz__options[hidden]{display:grid!important}
.quiz button,.quiz__feedback,.quiz__required,.quiz__recall,.quiz__teach-back,.quiz__revisit-guidance,.quiz__option input{display:none!important}
.quiz__option,.quiz__option:has(input:checked){background:#fff!important;border-color:#bbb!important}
}
`;
