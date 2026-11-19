import { seedMapping, write } from "../lib/harness.mjs";
import { buildPrompt } from "../lib/ontology-fixtures.mjs";

export default {
  name: "ontology-build-without-adrs-skips-review",
  description:
    "A first build in a project whose ADR root holds only an empty index and a decision log starts from the business evidence without a review question and records no review route.",
  obligations: [
    {
      id: "no-review-question",
      text: "The response does not ask whether to review ADRs first, since the project has no ADR documents (an empty index and a decision log do not count); it goes to the business evidence the user named.",
    },
    {
      id: "no-route-recorded",
      text: "It records no pre-build ADR review route (no `adr-review` preference such as review-first or build-direct is set); it may record the setup answer to build.",
    },
  ],
  build(dir) {
    seedMapping(dir, { categories: {} });
    write(
      dir,
      "docs/adr/decision-log.md",
      "# Decision log\n\n- 2026-09-01 ADR 작성을 시작하기로 했다.\n",
    );
    write(
      dir,
      "docs/quotes.md",
      "영업 담당자가 견적을 제출하면 영업 관리자가 승인하거나 반려한다.\n",
    );
    return buildPrompt(
      [
        "skills/ontology-build/references/preferences.md",
        "skills/ontology-build/references/pre-build-adr-review.md",
      ],
      "This project has no saved ontology. Its ADR root holds only docs/adr/.mapping.json (no categories) and docs/adr/decision-log.md. The project preference helper's `show` printed: {}",
      "The user was asked whether to create a business ontology and replied: “응, docs/quotes.md로 견적 업무부터 만들어 줘.”",
      "Do not call tools or write files. Respond to the user and list the commands you would run first, including any preference you record.",
    );
  },
};
