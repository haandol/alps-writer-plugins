import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { withTmp } from "./helpers.mjs";
import scenario from "../evals/scenarios/import-asks-intent-before-writing.mjs";
import { skillCatalog, routingCases } from "../evals/skills/catalog.mjs";
import { scenarioNamesForChangedPaths } from "../evals/impact-map.mjs";

import { makeTools } from "../evals/regression/workspace.mjs";

test("existing-project import and product handoff have distinct discoverable entrypoints", () => {
  const catalog = skillCatalog();
  assert.equal(catalog.filter((s) => s.name === "adr-import").length, 1);
  assert.deepEqual(routingCases.find((c) => c.id === "routing-project-import").required, [
    "adr-import",
  ]);
  assert.deepEqual(routingCases.find((c) => c.id === "routing-product-handoff").required, [
    "feature-to-adr",
  ]);
  assert.ok(
    !routingCases.find((c) => c.id === "routing-product-handoff").allowed.includes("adr-import"),
  );
  assert.ok(
    scenarioNamesForChangedPaths(["plugins/adr-writer/skills/adr-import/SKILL.md"], [scenario]).has(
      scenario.name,
    ),
  );
});

test("the import fixture requires source discovery and rejects preapproval index writes", () =>
  withTmp((dir) => {
    const prompt = scenario.build(dir);
    for (const obligation of scenario.obligations) assert.ok(!prompt.includes(obligation.text));
    const report = path.join(dir, ".adr-review/import/report.md");
    mkdirSync(path.dirname(report), { recursive: true });
    writeFileSync(
      report,
      "# decision-1 — Order intent\nThe project is a monorepo with independent services. Ordering owns member orders of one through three items; Billing owns payment completion. The unavailable repository remains unverified. Confirm the purpose and contract before saving.\n",
    );
    const logPath = path.join(dir, "events.jsonl");
    const tools = makeTools({
      root: dir,
      pluginRoot: path.resolve("plugins/adr-writer"),
      logPath,
      turn: 1,
      artifactPaths: scenario.artifactPaths,
    });
    for (const file of ["package.json", "deploy.md", "packages/checkout/backend/submit.mjs"])
      tools.call("read_file", { path: file });
    tools.call("write_file", {
      path: scenario.artifactPaths[0],
      content: readFileSync(report, "utf8"),
    });
    const events = readFileSync(logPath, "utf8").trim().split("\n").map(JSON.parse);
    assert.ok(scenario.score({ dir, events }).every((c) => c.pass));
    assert.ok(scenario.score({ dir, events: [] }).some((c) => !c.pass));
    mkdirSync(path.join(dir, "docs/adr"), { recursive: true });
    writeFileSync(path.join(dir, "docs/adr/.mapping.json"), "{}");
    assert.ok(scenario.score({ dir, events }).some((c) => !c.pass));
  }));
