import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { withTmp } from "./helpers.mjs";
import scenario, {
  score,
  fixtureFiles,
} from "../evals/scenarios/author-discovers-existing-boundaries.mjs";

import { makeTools } from "../evals/regression/workspace.mjs";

test("discovery verification requires inspected evidence and preserves every input", () =>
  withTmp((dir) => {
    scenario.build(dir);
    const report = path.join(dir, ".adr-review/discovery/report.md");
    mkdirSync(path.dirname(report), { recursive: true });
    writeFileSync(
      report,
      "# Discovery\nOne monorepo has independently deployed services. Ordering and Billing own separate business models. The fulfillment repository is unavailable. Intent questions remain pending.\n",
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
    assert.ok(score({ dir, events }).every((c) => c.pass));
    assert.ok(
      score({ dir, events: [] }).some((c) => !c.pass),
      "correct-looking prose cannot substitute for discovery",
    );
    const source = "packages/checkout/backend/submit.mjs";
    writeFileSync(path.join(dir, source), "changed");
    assert.ok(score({ dir, events }).some((c) => !c.pass));
    writeFileSync(path.join(dir, source), fixtureFiles[source]);
    assert.ok(
      score({
        dir,
        events: [...events, { kind: "request", tool: "write_file", arguments: { path: source } }],
      }).some((c) => !c.pass),
      "restoring a forbidden write does not erase the event",
    );
    mkdirSync(path.join(dir, "docs/adr"), { recursive: true });
    writeFileSync(path.join(dir, "docs/adr/.mapping.json"), "{}");
    assert.ok(score({ dir, events }).some((c) => !c.pass));
  }));
