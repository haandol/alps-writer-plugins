import { seedMapping } from "../lib/harness.mjs";
import { buildPrompt } from "../lib/ontology-fixtures.mjs";

const QUESTIONS = {
  version: 1,
  title: "반품 질문",
  questions: [
    {
      id: "Q1",
      text: "반품 승인은 누가 하나요?",
      options: [{ id: "cs", label: "고객지원 담당자" }],
    },
    { id: "Q2", text: "승인 뒤 환불은 누가 하나요?" },
    {
      id: "Q3",
      text: "반품 상품은 어떻게 회수하나요?",
      options: [
        { id: "courier", label: "택배사 회수" },
        { id: "customer", label: "고객이 직접 발송" },
      ],
    },
  ],
};

export default {
  name: "ontology-build-reads-conversation-answers",
  description:
    "On a host that cannot notify the agent, an answer given in the conversation is recorded by its question id, and answers the user says were sent on screen are read when the user says so.",
  obligations: [
    {
      id: "records-chat-answer",
      text: "The answer to Q3 given in the conversation is recorded for the screen with the same identifier: `ontology-ask.mjs record <run> Q3 --option courier`.",
    },
    {
      id: "reads-on-notice",
      text: "Because the user says the Q1 and Q2 answers were sent on the screen and this host cannot notify the agent, the response reads them now from the session (`ontology-ask.mjs wait <run> --timeout 1` or `ontology-ask.mjs answers <run>`) instead of asking the user to repeat them or waiting for a notification.",
    },
    {
      id: "no-fallback",
      text: "It does not promise an automatic response or start another model or provider to read the answers.",
    },
  ],
  build(dir) {
    seedMapping(dir, { categories: {} });
    return buildPrompt(
      ["skills/ontology-build/references/ask-session.md"],
      "You are building a first model of returns. Your run directory is .adr-review/20261119-returns-build and its web question session is open with this questions.json:",
      "```json\n" + JSON.stringify(QUESTIONS, null, 2) + "\n```",
      "This host cannot notify you when a background command finishes, so no `wait` result has reached you.",
      "사용자: Q3는 택배사 회수로 할게. 그리고 화면에서 Q1, Q2 답은 이미 보냈어.",
      "Do not call tools or write files. State what you do now, with the exact commands, in order.",
    );
  },
};
