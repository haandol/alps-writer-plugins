import { test } from "node:test";
import assert from "node:assert/strict";
import {
  relatedAdrComparisonProse,
  hillNarrativeParagraphs,
} from "../scripts/adr-impl-review-prose.mjs";

test("comparison composition preserves authored transitions without repeating them", () => {
  for (const [language, comparison, expected] of [
    [
      "ko",
      {
        similarity: "두 결정 모두 같은 경계를 지킨다.",
        difference: "반면 실패 결과는 다르다.",
        reviewImpact: "따라서 실패 경로를 따로 확인한다.",
      },
      "두 결정 모두 같은 경계를 지킨다. 반면 실패 결과는 다르다. 따라서 실패 경로를 따로 확인한다.",
    ],
    [
      "en",
      {
        similarity: "Both preserve the boundary.",
        difference: "However, the failure result differs.",
        reviewImpact: "Therefore, check failure separately.",
      },
      "Both preserve the boundary. However, the failure result differs. Therefore, check failure separately.",
    ],
  ]) {
    assert.equal(relatedAdrComparisonProse(comparison, language), expected);
  }
});

test("comparison composition supplies transitions only when missing and leaves escaping to the renderer", () => {
  const result = relatedAdrComparisonProse(
    {
      similarity: "Both preserve <input>.",
      difference: "the result differs.",
      reviewImpact: "check the result.",
    },
    "en",
  );
  assert.equal(
    result,
    "Both preserve <input>. However, the result differs. Therefore, check the result.",
  );
});

test("a Hill composes identical claims and responsibilities once without changing the source", () => {
  const hill = {
    sliceName: "Settlement",
    claim: "A request has one result.",
    workedExample: "A retry returns the stored result.",
    counterexample: "A second charge violates the boundary.",
    container: {
      responsibility: "A request has one result.",
      interactions: "The handler reads the stored result.",
      outcome: "The caller sees one result.",
    },
    assessment: "The caller sees one result.",
  };
  const original = structuredClone(hill);
  const paragraphs = hillNarrativeParagraphs(hill).join("\n");
  assert.equal(paragraphs.split(hill.claim).length - 1, 1);
  assert.equal(paragraphs.split(hill.assessment).length - 1, 1);
  assert.ok(paragraphs.includes(hill.counterexample));
  assert.deepEqual(hill, original);
});

test("equal numbers with different actors, units, or conditions are not deduplicated", () => {
  const hill = {
    sliceName: "Limits",
    claim: "A member may upload 5 files per month.",
    workedExample: "An admin may upload 5 files per day.",
    counterexample: "A member cannot upload 5 files after cancellation.",
    container: { responsibility: "Process 5 concurrent requests.", interactions: "", outcome: "" },
    assessment: "",
  };
  const paragraphs = hillNarrativeParagraphs(hill).join("\n");
  for (const value of [
    hill.claim,
    hill.workedExample,
    hill.counterexample,
    hill.container.responsibility,
  ]) {
    assert.ok(paragraphs.includes(value));
  }
});

test("deduplication stays local to a Hill and ignores only outer padding", () => {
  const hill = {
    sliceName: "One flow",
    claim: "Preserve the result.",
    container: { responsibility: "  Preserve the result.\n", interactions: "", outcome: "" },
  };
  for (const title of ["One flow", "Another flow"]) {
    const text = hillNarrativeParagraphs({ ...hill, sliceName: title }).join("\n");
    assert.equal(text.split("Preserve the result.").length - 1, 1);
  }
});

test("whitespace inside a quoted requirement value is preserved", () => {
  const hill = {
    sliceName: "Input rules",
    claim: "The input must contain 'a b'.",
    counterexample: "The input must contain 'a  b'.",
    container: {},
  };
  const text = hillNarrativeParagraphs(hill).join("\n");
  assert.ok(text.includes(hill.claim));
  assert.ok(text.includes(hill.counterexample));
});
