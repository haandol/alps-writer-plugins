import { seedMapping } from "../lib/harness.mjs";
import { buildPrompt } from "../lib/ontology-fixtures.mjs";

const QUESTIONS = {
  version: 1,
  title: "견적 처리 질문",
  questions: [
    {
      id: "Q1",
      text: "견적 승인은 누가 하나요?",
      options: [
        { id: "manager", label: "영업 관리자" },
        { id: "lead", label: "영업 팀장" },
      ],
    },
    {
      id: "Q2",
      text: "반려된 견적은 어떻게 되나요?",
      options: [
        { id: "fix", label: "영업 담당자가 고쳐 다시 제출" },
        { id: "close", label: "종료" },
      ],
    },
    { id: "Q3", text: "승인된 견적은 고객에게 어떻게 전달되나요?" },
  ],
};
const WAIT = `{"answers":[{"questionId":"Q1","question":"견적 승인은 누가 하나요?","optionId":"manager","optionLabel":"영업 관리자","text":"","channel":"web"},{"questionId":"Q2","question":"반려된 견적은 어떻게 되나요?","optionId":null,"optionLabel":null,"text":"고쳐서 다시 내되, 같은 견적은 두 번까지만 다시 낼 수 있다","channel":"web"}],"messages":[],"closed":false}`;

export default {
  name: "ontology-build-posts-follow-ups",
  description:
    "Delivered answers come back to the same session: updated candidates and follow-up questions are posted by rewriting its question file, then the agent listens again.",
  obligations: [
    {
      id: "applies",
      text: "The response applies the two delivered answers to the candidates (the sales manager approves; a returned quote is fixed and resubmitted, at most twice) through the candidates file and the candidate tool, not by saving the model.",
    },
    {
      id: "same-session",
      text: "It posts the result to the same open session by rewriting <run>/ask/questions.json: it closes or settles Q1 and Q2, adds at least one follow-up question with a new identifier (for example Q2.1 about what happens after the second resubmission), keeps the unanswered Q3, and sets agent.message to a short summary of what changed.",
    },
    {
      id: "listens-again",
      text: "It starts `ontology-ask.mjs wait <run>` again afterwards instead of ending the session or moving the questions to the conversation.",
    },
  ],
  build(dir) {
    seedMapping(dir);
    return buildPrompt(
      [
        "skills/ontology-build/references/candidate-review.md",
        "skills/ontology-build/references/candidates.md",
        "skills/ontology-build/references/ask-session.md",
      ],
      "You are building a first model of quotes from docs/quotes.md. Your run directory is .adr-review/20261119-quote-build. The web question session is open with this <run>/ask/questions.json:",
      "```json\n" + JSON.stringify(QUESTIONS, null, 2) + "\n```",
      "Your background `ontology-ask.mjs wait <run>` just returned:",
      "```json\n" + WAIT + "\n```",
      "Do not call tools or write files. State what you do now: the candidate changes, the exact questions.json you write, and the commands you run.",
    );
  },
};
