import { skillText, alpsSkillText, TAIL_SPEC } from "./harness.mjs";
import { responseChecks } from "./response-checks.mjs";

/** Compare identical business boundaries across different repository/deployment shapes. */
export function featureBoundaryScenario(product = false) {
  const mode = product === true ? "full" : product === false ? "adr" : product;
  const expected = {
    A: "TWO_CONTEXTS",
    B: "TWO_CONTEXTS",
    C: "HEADLESS",
    D: "PARTIAL",
    ...(mode === "handoff" ? { E: "REUSE", F: "PROPOSE", G: "ASK_BOUNDARY" } : {}),
  };
  const score = ({ tail }) =>
    Object.entries(expected).map(([tag, value]) => {
      const rows = tail?.findings ?? [];
      return {
        label: `${tag} preserves business boundaries and evidence scope`,
        pass:
          rows.length === Object.keys(expected).length &&
          rows.filter((r) => r.tag === tag).length === 1 &&
          (rows.find((r) => r.tag === tag)?.summary === value ||
            rows.find((r) => r.tag === tag)?.summary?.startsWith(value + " — ")),
        detail: rows.find((r) => r.tag === tag)?.summary ?? "missing",
      };
    });
  return {
    name: {
      adr: "author-groups-features-by-business-boundary",
      full: "alps-groups-features-by-business-boundary",
      lite: "lite-alps-groups-features-by-business-boundary",
      handoff: "feature-handoff-preserves-business-boundaries",
    }[mode],
    description:
      "Keep ordering and billing as business contexts across microservice and monolith layouts, with headless features and inaccessible repositories represented honestly.",
    obligations: [
      {
        id: "boundaries",
        text: "A is monorepo plus microservices, B is a single-repository monolith, but both retain ordering and billing contexts and vertical user stories. Do not group by frontend/backend/database or make each service a context. C has no invented UI. D is partial evidence, never a claim of complete multirepo inspection. Preserve the caller's document resolution and ask no already-resolved domain classification question. In handoff, E reuses confirmed ownership, F proposes a grounded missing grouping, and G retains the ownership conflict pending user judgment.",
      },
    ],
    score,
    deterministicScore(input) {
      return [...responseChecks(input, {}), ...score(input)];
    },
    build() {
      const prompt =
        mode === "adr"
          ? skillText("adr-new", { references: ["references/feature-boundaries.md"] })
          : alpsSkillText(
              { full: "alps-init", lite: "lite-alps-init", handoff: "feature-to-adr" }[mode],
              { references: ["references/feature-boundaries.md"] },
            );
      return [
        prompt,
        `# This run
Response-only organization probe. Do not use tools, write documents or request
approval to execute this probe. Describe the grouping, not a full document.
The user asks to organize product features and their decisions. Facts:
A: One repository contains independently deployed checkout API, order worker,
and settlement services. The checkout API and order worker share the ordering
language, order state rules and one business owner. Settlement has a different
billing model and owns payment completion. A user submits an order; asynchronous
processing confirms it. Settlement is a separate feature.
B: The same business meanings and ownership run in a single application deployed
as one monolith from one repository, with frontend/backend/database folders.
C: Billing's nightly settlement is an automated job triggered by a domain event;
there is no screen or interactive step.
D: Ordering references another repository that owns billing; that repository
was not supplied and is inaccessible. Only the ordering repository is available.
Describe repository organization separately from execution/deployment shape,
the business contexts and vertical features, and evidence limits.
${
  mode === "handoff"
    ? `Also process these independent input conditions:
E: The approved source explicitly confirms Ordering owns order submission and
Billing owns settlement. The existing ADR owners agree.
F: The approved source gives the same business vocabulary, rule ownership and
features as A but no context labels. Propose a grounded grouping.
G: The source calls order submission Billing-owned while an existing ADR says
Ordering owns it. Adoption and chronology cannot be established. State what
must remain unresolved before changing ownership.
Emit exactly A..G.`
    : "Emit exactly A..D."
}
For Lite, keep any explanation within the current four-section product model;
never add lower C4 levels or technical-layer features. For handoff, preserve
confirmed owners, propose missing boundaries and ask about material conflicts.
In EVAL-FINDINGS, summaries use TWO_CONTEXTS, THREE_CONTEXTS, LAYER_GROUPS,
HEADLESS, ADD_SCREEN, PARTIAL, COMPLETE, REUSE, PROPOSE or ASK_BOUNDARY.`,
        TAIL_SPEC,
      ].join("\n\n");
    },
  };
}
