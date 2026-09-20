// Select the smallest relevant behaviour-eval set from a Git diff.
//
// This is disposable execution routing, not a new source of product or ADR
// truth. The scenarios still load shipping prompts and judge observable
// behaviour; this table only avoids running unrelated live-model scenarios.

export const IMPACT_RULES = [
  {
    pathPrefixes: [
      "plugins/adr-writer/templates/adr/",
      "plugins/adr-writer/evals/lib/",
      "plugins/adr-writer/evals/run.mjs",
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
    pathPrefixes: ["plugins/adr-writer/evals/regression/judge.mjs"],
    scenarioPrefixes: ["alps-approval-digest-"],
  },
  {
    pathPrefixes: ["plugins/alps-writer/skills/lite-alps-init/"],
    scenarioPrefixes: ["lite-alps-"],
  },
  {
    pathPrefixes: ["plugins/alps-writer/src/tools/documents/"],
    scenarioPrefixes: ["alps-", "lite-alps-"],
  },
  {
    pathPrefixes: ["plugins/adr-writer/hooks/"],
    scenarioPrefixes: ["hook-"],
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
  const normalized = changedPaths.map((value) => value.replaceAll("\\", "/"));

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
