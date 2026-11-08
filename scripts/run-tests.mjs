#!/usr/bin/env bun
// Run a named group of test files with Bun's test runner, split across a few
// processes the way per-file workers used to run. Each shard's output is printed
// after it finishes, then a summary; the exit code is non-zero if any shard fails.
//
// Usage: bun scripts/run-tests.mjs <group>
//   groups: all, unit, unit-mjs, unit-adr, integration, integration-adr-ontology,
//           adr, ontology, alps, deepeval, workspace, report-rendering
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { availableParallelism } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = (dir, { recursive = false } = {}) =>
  readdirSync(path.join(ROOT, dir), { recursive })
    .map(String)
    .filter((name) => /\.test\.(mjs|ts)$/.test(name) && !name.includes("node_modules"))
    .map((name) => "./" + path.posix.join(dir, name.split(path.sep).join("/")))
    .sort();
const integration = (file) => /\.integration\.test\.mjs$/.test(file);
const unit = (list) => list.filter((f) => !integration(f));
const only = (list) => list.filter(integration);

const adrTests = files("plugins/adr-writer/tests", { recursive: true });
const deepeval = files("plugins/adr-writer/evals/deepeval");
const adrBrowser = files("plugins/adr-writer/integration-tests");
const ontologyTests = files("plugins/ontology-writer/tests", { recursive: true });
const ontologyBrowser = files("plugins/ontology-writer/integration-tests");
const alps = files("plugins/alps-writer/tests", { recursive: true });

const GROUPS = {
  all: [...alps, ...adrTests, ...deepeval, ...adrBrowser, ...ontologyTests, ...ontologyBrowser],
  unit: [...alps, ...unit(adrTests), ...unit(deepeval), ...unit(ontologyTests)],
  integration: [
    ...only(adrTests),
    ...only(deepeval),
    ...adrBrowser,
    ...only(ontologyTests),
    ...ontologyBrowser,
  ],
  "unit-mjs": [...unit(adrTests), ...unit(deepeval), ...unit(ontologyTests)],
  "unit-adr": unit(adrTests),
  "integration-adr-ontology": [...only(adrTests), ...ontologyTests],
  adr: adrTests,
  ontology: [...ontologyTests, ...ontologyBrowser],
  alps,
  deepeval,
  workspace: [...alps, ...deepeval, ...adrBrowser, ...ontologyBrowser],
  "report-rendering": ["./plugins/adr-writer/integration-tests/mermaid.test.mjs"],
};

const group = process.argv[2];
if (!GROUPS[group] || process.argv.length > 3) {
  console.error(`Usage: bun scripts/run-tests.mjs <${Object.keys(GROUPS).join("|")}>`);
  process.exit(2);
}
const list = GROUPS[group];
const width = Math.max(
  1,
  Math.min(list.length, Number(process.env.TEST_SHARDS) || availableParallelism()),
);
const shards = Array.from({ length: width }, () => []);
list.forEach((file, i) => shards[i % width].push(file));

const run = (shard) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, ["test", "--timeout", "600000", ...shard], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });

const results = await Promise.all(shards.map(run));
let pass = 0,
  fail = 0;
for (const { out } of results) {
  process.stdout.write(out);
  pass += Number(/^\s*(\d+) pass$/m.exec(out)?.[1] ?? 0);
  fail += Number(/^\s*(\d+) fail$/m.exec(out)?.[1] ?? 0);
}
const failed = results.filter((r) => r.code !== 0).length;
console.log(
  `\n${group}: ${list.length} files, ${pass} pass, ${fail} fail, ${failed} failing shard(s)`,
);
process.exitCode = failed ? 1 : 0;
