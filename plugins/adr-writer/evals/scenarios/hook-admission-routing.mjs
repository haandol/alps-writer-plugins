import { hookContext, ruleText, seedRuleDocs, TAIL_SPEC, expectText } from "../lib/harness.mjs";

export default {
  name: "hook-admission-routing",
  description:
    "The emitted SessionStart directive must route a requirement-value change ADR-first while leaving a replaceable SDK swap at code level.",

  build(dir) {
    seedRuleDocs(dir);
    const directive = hookContext(dir);
    return [
      directive,
      `\n---\n\n# Reference vocabulary`,
      ruleText("concepts.md"),
      `\n---\n\n# This run`,
      `Classify both requests independently:`,
      `A. Keep the Bedrock provider/model and fallback unchanged; replace only the SDK and credential adapter.`,
      `B. Change the free-plan upload quota from 5 per month to 3 per month.`,
      `Do not execute either request. State the route only.`,
      `Use EXEMPT for code-level work and ADR_FIRST for admitted work in the tail.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const all = `${output}\n${tail.raw}`;
    const wronglyAdmitted = tail.findings.filter(
      (finding) =>
        /ADR_FIRST/i.test(finding.tag) &&
        (/(?:^|\s)A(?:\s|:)/.test(finding.summary) ||
          /SDK|credential adapter/i.test(finding.summary)),
    );
    return [
      expectText(all, /EXEMPT.{0,180}(SDK|credential|adapter)/is, "routes the SDK swap to code"),
      expectText(
        all,
        /ADR_FIRST.{0,180}(5.{0,40}3|quota|쿼터|업로드)/is,
        "routes the quota change ADR-first",
      ),
      {
        pass: wronglyAdmitted.length === 0,
        detail:
          wronglyAdmitted.map((finding) => `${finding.tag} | ${finding.summary}`).join(" ; ") ||
          "no ADR_FIRST finding for request A",
        label: "does not promote the replaceable SDK choice",
      },
    ];
  },
};
