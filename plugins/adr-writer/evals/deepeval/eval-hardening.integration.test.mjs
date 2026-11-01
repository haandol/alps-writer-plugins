import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { main } from "../skills/run.mjs";
import { catalog } from "../skills/catalog.mjs";
import { makeTools } from "../regression/workspace.mjs";
import { toolServerOptions } from "../regression/tool-config.mjs";
import { adopt } from "../../tests/fixtures/import-approved-documents.mjs";

// Every temporary folder this file creates is removed when the file finishes,
// so repeated runs do not fill the system temporary directory.
const created = [];
const temp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "eval-hardening-"));
  created.push(dir);
  return dir;
};
after(() => {
  for (const dir of created) rmSync(dir, { recursive: true, force: true });
});
const text = "Controlled fixture response.";
const reply = (rows) =>
  `${text}\n=== EVAL-VERDICT: PASS ===\n=== EVAL-FINDINGS ===\n${rows}\n=== EVAL-END ===`;
function fixtureTools(config) {
  const options = toolServerOptions(
    JSON.parse(readFileSync(config, "utf8")).mcpServers.fixture.args.slice(1),
  );
  return { root: options.root, turn: options.turn, tools: makeTools(options) };
}
const passingJudge = (item) => async () => ({
  structured: {
    score: 1,
    reason: "Controlled permissive judge for pipeline testing.",
    obligations: (item.semanticObligations ?? item.obligations).map(({ id }) => ({
      id,
      verdict: "PASS",
      reason: "Controlled judge result.",
      evidence: [{ source: "reply:1", quote: text }],
    })),
  },
  models: ["judge-stub"],
  costUSD: 0,
  ms: 1,
});

test("classification uses configured report permissions and authored default-object obligations", async () => {
  const item = (await catalog()).find((c) => c.id === "import-asks-intent-before-writing");
  assert.deepEqual(
    item.semanticObligations.map((o) => o.id),
    ["import"],
  );
  const result = await main(
    ["--live", "--suite", "classification", "--runs", "1", "--out", temp()],
    {
      cases: [item],
      judge: passingJudge(item),
      target: async ({ config }) => {
        const { tools } = fixtureTools(config);
        for (const file of ["package.json", "deploy.md", "packages/checkout/backend/submit.mjs"])
          tools.call("read_file", { path: file });
        tools.call("write_file", {
          path: item.artifactPaths[0],
          content:
            "# decision-1 — Order purpose\nThe member rule and three-item cap are observed. Confirm their purpose before adopting them. The payment owner and unavailable repository are separate scope, not inferred implementation.\n",
        });
        return { text: reply("NONE"), models: ["target-stub"], costUSD: 0, ms: 1 };
      },
    },
  );
  assert.equal(result.report.runs[0].verdict, "PASS");
  assert.ok(result.report.runs[0].checks.every((c) => c.pass));
  assert.equal(result.report.runs[0].calls.filter((c) => c.stage === "judge").length, 1);
});

test("a semantic PASS cannot hide a forbidden response-only write after catalog registration", async () => {
  const item = (await catalog()).find((c) => c.id === "sync-resumes-confirmed-batch");
  const result = await main(
    ["--live", "--suite", "classification", "--runs", "1", "--out", temp()],
    {
      cases: [item],
      judge: passingJudge(item),
      target: async ({ config }) => {
        const { tools } = fixtureTools(config);
        tools.call("write_file", { path: "docs/unapproved.md", content: "Unexpected mutation" });
        return {
          text: reply("A | CONTINUE\nB | APPLY\nC | DEFER"),
          models: ["target-stub"],
          costUSD: 0,
          ms: 1,
        };
      },
    },
  );
  assert.equal(result.report.runs[0].verdict, "NOT_PROVEN");
  assert.ok(
    result.report.runs[0].checks.some(
      (c) => c.label === "mutations remain within fixture task permissions" && !c.pass,
    ),
  );
});

test("execution checks gate real multi-turn capture even when final files and semantic judgment look valid", async () => {
  const item = (await catalog()).find((c) => c.id === "import-confirmed-adoption-and-repeat");
  // One runner call shares plugin snapshots; each combination is its own case with its own
  // fixture, captured turns, execution checks and judgment.
  const combinations = [false, true].map((rewrite, index) => ({
    id: `${item.id}-${index + 1}`,
    rewrite,
  }));
  const byRun = new Map(combinations.map((c) => [`${c.id}-candidate-1`, c]));
  const result = await main(
    [
      "--live",
      "--suite",
      "execution",
      "--reference-date",
      "2026-09-30",
      "--runs",
      "1",
      "--out",
      temp(),
    ],
    {
      cases: combinations.map(({ id }) => ({ ...item, id })),
      judge: passingJudge(item),
      target: async ({ cwd, config }) => {
        const { rewrite } = byRun.get(path.basename(path.dirname(cwd)));
        const { tools, turn } = fixtureTools(config);
        if (turn === 1)
          tools.call("write_file", {
            path: item.artifactPaths[0],
            content:
              "# decision-1 and decision-2\nConfirm the displayed member-order and payment-completion contracts and their current intent. Both owners are identified and official ADRs have not been written.\n",
          });
        if (turn === 2) adopt(tools, ["ordering", "billing"]);
        if (turn === 3 && rewrite) {
          const file = "docs/adr/ordering/0001-ordering.md";
          tools.call("write_file", {
            path: file,
            content: tools.call("read_file", { path: file }),
          });
        }
        return { text, models: ["target-stub"], costUSD: 0, ms: 1 };
      },
    },
  );
  for (const { id, rewrite } of combinations) {
    const record = result.report.runs.find((r) => r.caseId === id);
    assert.equal(record.verdict, rewrite ? "NOT_PROVEN" : "PASS", record.error);
    assert.equal(record.calls.filter((c) => c.stage === "target").length, 3);
    assert.ok(
      record.checks.some(
        (c) =>
          c.label === "equivalent repeat performs no official writes or content changes" &&
          c.pass === !rewrite,
      ),
    );
  }
});
