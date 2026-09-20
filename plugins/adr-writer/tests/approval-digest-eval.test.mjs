import assert from "node:assert/strict";
import test from "node:test";
import scenario, {
  obligations,
} from "../evals/scenarios/alps-approval-digest-preserves-contract.mjs";
import { parseTail } from "../evals/lib/harness.mjs";
import { digestCases } from "./fixtures/approval-digest-cases.mjs";

test("digest scoring sends visible text and tail to a separate semantic judge", async () => {
  for (const item of digestCases) {
    let calls = 0;
    const checks = await scenario.score({
      output: item.output,
      tail: parseTail(item.output),
      invoke: async (prompt) => {
        calls++;
        const payload = JSON.parse(prompt.slice(prompt.indexOf("\n\n") + 2));
        assert.deepEqual(payload.obligations, obligations);
        assert.equal(payload.evidenceSources.visible + payload.evidenceSources.tail, item.output);
        assert.ok(!payload.evidenceSources.visible.includes("EVAL-VERDICT"));
        // This stub checks transport/validation, not a model's interpretation.
        return {
          structured: {
            obligations: obligations.map(({ id }) => ({
              id,
              verdict: item.failed.includes(id) ? "FAIL" : "PASS",
              reason: item.failed.includes(id)
                ? "작성한 반례가 해당 계약을 위반합니다."
                : "작성한 기준 응답이 해당 계약을 보존합니다.",
              evidence: [{ source: "visible", quote: payload.evidenceSources.visible.trim() }],
            })),
          },
        };
      },
    });
    assert.equal(calls, 1);
    assert.equal(checks.length, obligations.length);
    assert.deepEqual(
      checks.filter((c) => !c.pass).map((c) => c.label.split(": ")[1]),
      item.failed,
      item.id,
    );
  }
});

test("invalid semantic judgments and provider errors are unscorable, not green checks", async () => {
  const output = digestCases[0].output;
  for (const raw of [
    { obligations: [] },
    {
      obligations: obligations.map(({ id }) => ({
        id,
        verdict: "PASS",
        reason: "없는 근거로 통과를 주장합니다.",
        evidence: [{ source: "missing", quote: "approved" }],
      })),
    },
  ]) {
    await assert.rejects(scenario.score({ output, invoke: async () => ({ structured: raw }) }));
  }
  await assert.rejects(
    scenario.score({
      output,
      invoke: async () => {
        throw new Error("provider failed");
      },
    }),
    /provider failed/,
  );
});
