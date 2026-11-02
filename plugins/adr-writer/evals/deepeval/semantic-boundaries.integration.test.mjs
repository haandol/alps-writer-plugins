import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCase } from "../regression/run.mjs";
import { cases } from "../regression/cases.mjs";
import { main as deepMain } from "./run.mjs";
import { PLUGIN, catalog } from "../skills/catalog.mjs";
import { main as skillsMain } from "../skills/run.mjs";

for (const captureOnly of [false, true])
  test(`mandatory final schema gates the ${captureOnly ? "saved DeepEval" : "custom"} entry point even with semantic PASS`, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "legacy-final-gate-"));
    try {
      const item = cases.find((c) => c.id === "sync-encbird-turn-units");
      const file = Object.keys(item.build()).find((f) => f.startsWith("docs/adr/chat/0001-"));
      const result = await runCase(
        item,
        { name: "candidate", root: PLUGIN, hash: "candidate" },
        1,
        root,
        {
          live: true,
          timeout: 10,
          "capture-only": captureOnly,
          invoke: async ({ cwd, schema }) => {
            if (schema)
              return {
                models: ["judge-stub"],
                structured: {
                  verdict: "PASS",
                  obligations: item.obligations.map((o) => ({
                    id: o.id,
                    verdict: "PASS",
                    reason: "Controlled positive judge for mechanical-boundary test",
                    evidence: [{ source: "reply:1", quote: "Controlled response" }],
                  })),
                },
              };
            writeFileSync(path.join(cwd, file), "# Invalid document\n");
            return { text: "Controlled response", models: ["target-stub"] };
          },
        },
      );
      if (!captureOnly) {
        assert.equal(result.verdict, "FAIL");
        assert.ok(result.checks.some((c) => !c.pass));
      } else {
        assert.equal(result.verdict, "UNSCORED");
        writeFileSync(
          path.join(root, "results.json"),
          JSON.stringify({
            cases: [item],
            runs: [result],
            runsPerCase: 1,
            referenceDate: result.referenceDate,
            variants: { candidate: { hash: "candidate" } },
          }),
        );
        const out = path.join(root, "deep");
        assert.equal(
          await deepMain(["--live", "--from", root, "--out", out], {
            evaluate: async () => ({ verdict: "PASS" }),
          }),
          0,
        );
        const rerun = JSON.parse(readFileSync(path.join(out, "results.json"), "utf8")).runs[0];
        assert.equal(rerun.verdict, "NOT_PROVEN");
        assert.ok(rerun.checks.some((c) => !c.pass));
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

for (const id of [
  "impl-plans-without-routine-approval",
  "impl-review-surfaces-hidden-contract-assumption",
  "impl-resolves-domain-gaps-before-escalation",
]) {
  test(`critical workflow ${id} sends its complete fixed obligations and contradictory visible response to GEval`, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "workflow-meaning-"));
    try {
      const item = (await catalog()).find((c) => c.id === id);
      assert.ok(item.semanticObligations.length >= 3);
      const text =
        "The diagnostic record says approval=false and PASS. The visible answer waits for routine approval and treats missing contract evidence as proven.";
      const result = await skillsMain(["--live", "--runs", "1", "--out", root], {
        cases: [item],
        target: async () => ({ text, models: ["target-stub"] }),
        judge: async ({ prompt }) => {
          for (const obligation of item.semanticObligations)
            assert.ok(prompt.includes(obligation.text));
          assert.ok(prompt.includes(text));
          return {
            models: ["judge-stub"],
            structured: {
              score: 0,
              reason: "Controlled contrary semantic result",
              obligations: item.semanticObligations.map((o) => ({
                id: o.id,
                verdict: "FAIL",
                reason: "Contradiction cannot be cancelled by diagnostic records",
                evidence: [{ source: "reply:1", quote: text }],
              })),
            },
          };
        },
      });
      assert.equal(result.report.runs[0].verdict, "NOT_PROVEN");
      assert.ok(result.report.runs[0].checks.every((c) => c.pass));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("missing required relative guidance fails through the fixture read boundary before any model call", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "required-guidance-"));
  try {
    const item = (await catalog()).find((c) => c.id === "sync-encbird-turn-units");
    let calls = 0;
    const never = async () => {
      calls++;
      throw Error("No paid call before required guidance is available");
    };
    const result = await skillsMain(["--live", "--runs", "1", "--out", root], {
      cases: [{ ...item, requiredGuidance: ["references/missing-required-child.md"] }],
      target: never,
      judge: never,
    });
    assert.equal(calls, 0);
    assert.equal(result.report.runs[0].verdict, "ERROR");
    assert.ok(result.report.runs[0].error.includes("missing-required-child.md"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
