// Select the smallest relevant behaviour-eval set from a Git diff.
//
// This is disposable execution routing, not a new source of product or ADR
// truth. The scenarios still load shipping prompts and judge observable
// behaviour; this table only avoids running unrelated live-model scenarios.

// This fixture belongs to the four proposal probes. Other lib/ changes retain
// the shared-harness fallback.
const paymentProposalScenarios = [
  "author-checks-business-rule-proposal",
  "author-checks-business-value-proposal",
  "hook-business-rule-proposal",
  "hook-value-change-proposal",
];

// This fixture reads the shipped MCP guidance for the skill-less in-authoring research scenarios.
const alpsMcpScenarios = [
  "alps-research-inflight-mcp-full",
  "alps-research-inflight-mcp-lite",
  "alps-feature-rubric-mcp-only",
  "lite-alps-resume-preserves-proposal-first",
];

// These fixtures belong to the Full ALPS scenarios that derive from a Lite source.
const liteDerivationScenarios = [
  "alps-full-derives-from-lite-without-reasking",
  "alps-full-relays-unusable-source-next-steps",
  "alps-full-routes-business-gap-to-lite",
];

/** Private fixtures and the scenarios that import them; tests compare both lists. */
export const PRIVATE_FIXTURE_SCENARIOS = new Map([
  ["plugins/adr-writer/evals/lib/payment-change.mjs", paymentProposalScenarios],
  ["plugins/adr-writer/evals/lib/lite-derivation.mjs", liteDerivationScenarios],
  ["plugins/adr-writer/evals/lib/alps-mcp-surfaces.mjs", alpsMcpScenarios],
]);

/** Route a private fixture change like edits to its consuming scenarios in either runner. */
export function evaluationImpactPaths(paths) {
  return paths.flatMap((path) => {
    const normalized = path.replaceAll("\\", "/");
    const consumers = PRIVATE_FIXTURE_SCENARIOS.get(normalized);
    if (!consumers) return [normalized];
    return consumers.map((name) => `plugins/adr-writer/evals/scenarios/${name}.mjs`);
  });
}

export const IMPACT_RULES = [
  {
    pathPrefixes: [
      "plugins/adr-writer/references/execution-boundary.md",
      "plugins/ontology-writer/references/execution-boundary.md",
    ],
    scenarioPrefixes: ["impl-review-stays-local-"],
  },
  {
    pathPrefixes: [
      "plugins/adr-writer/references/outcome-evaluation.md",
      "plugins/alps-writer/references/outcome-evaluation.md",
    ],
    scenarioPrefixes: [
      "alps-evaluates-outcomes-",
      "alps-feature-demo-outcome-",
      "alps-metrics-section8-",
      "impl-distinguishes-",
    ],
  },
  {
    pathPrefixes: [
      "plugins/adr-writer/references/implementation-evidence.md",
      "plugins/adr-writer/skills/adr-impl/references/implementation-hiking.md",
    ],
    scenarioPrefixes: ["impl-distinguishes-validation-"],
  },
  {
    pathPrefixes: [
      "plugins/adr-writer/skills/adr-import/",
      "plugins/adr-writer/references/import-cycle-resolution.md",
    ],
    scenarioPrefixes: ["import-"],
  },
  {
    pathPrefixes: [
      "plugins/adr-writer/references/feature-boundaries.md",
      "plugins/alps-writer/references/feature-boundaries.md",
    ],
    scenarioPrefixes: ["author-", "alps-", "lite-alps-", "feature-handoff-", "import-"],
  },
  {
    // The scenarios that load this reference; eval-impact.test.mjs checks it against
    // scenario sources.
    pathPrefixes: ["plugins/adr-writer/references/business-context.md"],
    scenarioPrefixes: [
      "author-checks-business-",
      "impl-reports-business-",
      "author-records-confirmed-unlinked",
      "author-sync-starts-business-query",
    ],
  },
  {
    pathPrefixes: [
      "plugins/ontology-writer/references/ontology.md",
      "plugins/ontology-writer/scripts/ontology",
      "plugins/ontology-writer/scripts/model-documents.mjs",
      "plugins/adr-writer/scripts/model-documents.mjs",
      "plugins/ontology-writer/templates/ontology/",
    ],
    scenarioPrefixes: [
      "author-checks-business-",
      "impl-reports-business-",
      "ontology-",
      "hook-business-rule-proposal",
      "hook-value-change-proposal",
    ],
  },
  {
    pathPrefixes: ["plugins/ontology-writer/skills/ontology-"],
    scenarioPrefixes: ["ontology-"],
  },
  {
    pathPrefixes: ["plugins/adr-writer/references/glossary.md"],
    scenarioPrefixes: ["author-defers-model-owned-", "feature-handoff-routes-model-owned-"],
  },
  {
    pathPrefixes: ["plugins/adr-writer/references/decision-questions.md"],
    scenarioPrefixes: ["sync-", "rollup-", "import-"],
  },
  {
    pathPrefixes: ["plugins/adr-writer/references/decision-reconciliation.md"],
    scenarioPrefixes: ["sync-", "rollup-"],
  },
  {
    pathPrefixes: [
      "plugins/adr-writer/references/comprehension-load.md",
      "plugins/alps-writer/references/comprehension-load.md",
    ],
    scenarioPrefixes: [
      "comprehension-load-",
      "alps-high-load-",
      "author-",
      "feature-handoff-",
      "impl-",
    ],
  },
  {
    pathPrefixes: [
      "plugins/adr-writer/references/requirement-delegation.md",
      "plugins/alps-writer/references/requirement-delegation.md",
    ],
    scenarioPrefixes: ["author-delegation-", "feature-handoff-delegation-", "impl-uses-intent-"],
  },
  {
    pathPrefixes: [
      "plugins/adr-writer/templates/adr/",
      "plugins/adr-writer/evals/lib/",
      "plugins/adr-writer/evals/run.mjs",
      "plugins/adr-writer/evals/regression/tool-config.mjs",
      "plugins/adr-writer/evals/regression/workspace.mjs",
      "plugins/adr-writer/evals/impact-map.mjs",
      "plugins/adr-writer/scripts/adr-lint-lib.mjs",
    ],
    allScenarios: true,
  },
  {
    pathPrefixes: [
      "plugins/alps-writer/skills/alps-init/",
      "plugins/alps-writer/src/guides/",
      "plugins/alps-writer/src/templates/",
      "plugins/alps-writer/src/index.ts",
      "plugins/alps-writer/src/profiles.ts",
    ],
    scenarioPrefixes: ["alps-", "lite-alps-", "feature-handoff-"],
  },
  {
    pathPrefixes: ["plugins/alps-writer/skills/feature-to-adr/"],
    scenarioPrefixes: ["feature-handoff-"],
  },
  {
    pathPrefixes: ["plugins/alps-writer/skills/lite-alps-init/"],
    scenarioPrefixes: [
      "lite-alps-",
      "alps-evaluates-outcomes-",
      "alps-research-offers-once-after-lite-",
      "alps-research-offers-not-again-",
      "alps-research-offers-after-inflight-",
    ],
  },
  {
    pathPrefixes: ["plugins/alps-writer/skills/alps-research/"],
    scenarioPrefixes: ["alps-research-reports-", "alps-research-applies-"],
  },
  {
    // The committed bundle supplies these scenarios' MCP guidance or resume text.
    pathPrefixes: ["plugins/alps-writer/dist/"],
    scenarioPrefixes: [
      "alps-research-inflight-mcp-",
      "alps-feature-rubric-mcp-",
      "lite-alps-resume-",
    ],
  },
  {
    pathPrefixes: ["plugins/alps-writer/src/tools/documents/"],
    scenarioPrefixes: ["alps-", "lite-alps-"],
  },
  {
    // Each hook's output also depends on the model discovery it imports.
    pathPrefixes: ["plugins/adr-writer/hooks/", "plugins/adr-writer/scripts/model-documents.mjs"],
    scenarioPrefixes: ["hook-", "ontology-query-chooses-entry-point"],
  },
  {
    pathPrefixes: [
      "plugins/ontology-writer/hooks/",
      "plugins/ontology-writer/scripts/model-documents.mjs",
    ],
    scenarioPrefixes: [
      "hook-business-",
      "hook-value-",
      "ontology-session-",
      "author-checks-business-rule-proposal",
      "author-checks-business-value-proposal",
      "author-sync-starts-business-query",
      "ontology-query-chooses-entry-point",
    ],
  },
  {
    pathPrefixes: ["plugins/adr-writer/skills/adr-new/"],
    scenarioPrefixes: ["author-", "feature-handoff-"],
  },
  {
    pathPrefixes: [
      "plugins/adr-writer/skills/adr-review/",
      "plugins/adr-writer/agents/adr-reviewer.md",
    ],
    scenarioPrefixes: ["review-"],
  },
  {
    pathPrefixes: ["plugins/adr-writer/skills/adr-sync/"],
    scenarioPrefixes: ["sync-"],
  },
  {
    pathPrefixes: ["plugins/adr-writer/skills/adr-rollup/"],
    scenarioPrefixes: ["rollup-"],
  },
  {
    pathPrefixes: [
      "plugins/adr-writer/skills/adr-impl/",
      "plugins/adr-writer/skills/adr-impl-refactor/",
      "plugins/adr-writer/agents/adr-impl-refactor-reviewer.md",
    ],
    scenarioPrefixes: ["impl-", "refactor-", "bedrock-", "comprehension-load-"],
  },
  {
    pathPrefixes: [
      "plugins/adr-writer/skills/adr-impl-review/",
      "plugins/adr-writer/agents/adr-impl-",
      "plugins/adr-writer/scripts/adr-impl-review-",
    ],
    scenarioPrefixes: ["impl-review-", "impl-completes-", "bedrock-"],
  },
];

export function scenarioNamesForChangedPaths(changedPaths, scenarios) {
  const names = new Set();
  const normalized = evaluationImpactPaths(changedPaths);

  for (const scenario of scenarios) {
    const file = scenario.file ?? `${scenario.name}.mjs`;
    if (normalized.includes(`plugins/adr-writer/evals/scenarios/${file}`)) {
      names.add(scenario.name);
    }
  }

  for (const rule of IMPACT_RULES) {
    const matched = normalized.some((changedPath) =>
      rule.pathPrefixes.some((prefix) => changedPath.startsWith(prefix)),
    );
    if (!matched) continue;

    if (rule.allScenarios) {
      for (const scenario of scenarios) names.add(scenario.name);
      continue;
    }

    for (const scenario of scenarios) {
      if (rule.scenarioPrefixes.some((prefix) => scenario.name.startsWith(prefix))) {
        names.add(scenario.name);
      }
    }
  }

  return names;
}
