import { seedMapping } from "../lib/harness.mjs";
import { buildPrompt } from "../lib/ontology-fixtures.mjs";

const WAIT = `{"answers":[],"messages":[{"messageId":"m-7","text":"설명 고마워요. 이대로 모델 저장해 주세요. 남은 질문은 전부 추천안으로 해 주세요.","context":"Q2","at":"2026-11-19T01:12:00.000Z"}],"closed":false}`;

export default {
  name: "ontology-build-discussion-is-not-approval",
  description:
    "A model question in the session's discussion area that asks to save is answered as discussion; it changes no candidate answer or progress and writes nothing to the model, index or glossary.",
  obligations: [
    {
      id: "reply-only",
      text: "The response answers message m-7 as a discussion reply (through `ontology-ask.mjs reply` with that message id) and does not treat it as a candidate answer: it records no answer, selects no recommended option and does not change the answered-question count.",
    },
    {
      id: "no-write",
      text: "It runs no save step — no `impact` approval, `apply`, or write to the model, ADR index or glossary — because a discussion message is not the save approval; it points the user to the approval in the main conversation (or explains that saving is approved there).",
    },
  ],
  build(dir) {
    seedMapping(dir, { categories: {} });
    return buildPrompt(
      [
        "skills/ontology-build/references/candidate-review.md",
        "skills/ontology-build/references/ask-session.md",
        "skills/ontology-build/references/save.md",
      ],
      "You are building a first model of quotes. The web question session is open with Q1–Q4; the user answered Q1 on the screen. Your background `ontology-ask.mjs wait <run>` just returned:",
      "```json\n" + WAIT + "\n```",
      "Do not call tools or write files. State what you do now, with the commands you run.",
    );
  },
};
