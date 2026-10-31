import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC } from "../lib/harness.mjs";

export default {
  name: "impl-review-completion-does-not-auto-quiz",
  description:
    "An ordinary implementation-review completion response returns the verdict, tests, and HTML path without printing Q1 or starting interactive grading.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl-review"),
      `\n---\n\n# This run`,
      `The implementation review is complete: verdict PASS, every contract row is PROVEN, and all tests passed.`,
      `The validated HTML report is /tmp/review/adr-impl-review-report.html and contains this prepared question:`,
      `Q1: Why does provider failure leave the payment pending instead of completed?`,
      `The user did not request an interactive comprehension check.`,
      `Return the ordinary main-session completion response.`,
      `It must report the verdict, tests, and HTML path without printing any question, grading criterion, evidence, or answer request.`,
      `In EVAL-FINDINGS include exactly:`,
      `COMPLETION | autoQuiz=false; questionVisible=false; reportPath=true; verdict=PASS`,
      TAIL_SPEC,
    ].join("\n");
  },
};
