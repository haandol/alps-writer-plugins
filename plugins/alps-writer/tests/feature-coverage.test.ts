import assert from "node:assert/strict";
import { test } from "node:test";
import { featureCoverage } from "../src/tools/documents/feature-coverage.js";

test("missing and replaced numeric features cannot be covered by unrelated entries or body references", () => {
  const source = "| F1 | Login | Must-Have |\n| F2 | Logout | Must-Have |";
  const entries = new Map([
    ["7.1", { title: "Login", content: "After login, the user may invoke F2." }],
    ["7.2", { title: "Export", content: "Download a file." }],
    ["7.3", { title: "F2: Logout", content: "Wrong numbered slot." }],
  ]);
  assert.deepEqual(featureCoverage(source, entries), { expected: 2, written: 1, missing: ["F2"] });
  entries.set("7.2", { title: "Logout", content: "End the session." });
  assert.deepEqual(featureCoverage(source, entries), { expected: 2, written: 2, missing: [] });
  entries.set("7.2", { title: "Logout", content: " \n " });
  assert.deepEqual(featureCoverage(source, entries), { expected: 2, written: 1, missing: ["F2"] });
});

test("named feature identity survives reordered slots and references to other features", () => {
  const source = "| F-AUTH-LOGIN | Login | Must-Have |\n| F-AUTH-LOGOUT | Logout | Must-Have |";
  const entries = new Map([
    ["7.2", { title: "F-AUTH-LOGIN: Login", content: "May lead to F-AUTH-LOGOUT." }],
    [
      "7.1",
      { title: "Logout", content: "Feature ID: F-AUTH-LOGOUT | Priority: Must-Have\nEnd session." },
    ],
  ]);
  assert.deepEqual(featureCoverage(source, entries), { expected: 2, written: 2, missing: [] });
  entries.set("7.1", { title: "Logout", content: "End the session." });
  assert.equal(
    featureCoverage(source, entries).written,
    2,
    "an unambiguous declared name remains usable",
  );
});

test("duplicate and contradictory feature identities remain incomplete", () => {
  const source = "- F-AUTH-LOGIN: Login\n- F-AUTH-LOGOUT: Logout";
  const entries = new Map([
    ["7.1", { title: "F-AUTH-LOGIN: Login", content: "Login result." }],
    ["7.2", { title: "F-AUTH-LOGIN: Login", content: "Repeated login result." }],
  ]);
  assert.equal(featureCoverage(source, entries).written, 0);
  entries.set("7.2", {
    title: "F-AUTH-LOGOUT: Logout",
    content: "Feature ID: F-AUTH-LOGIN\nConflicting identity.",
  });
  assert.deepEqual(featureCoverage(source, entries), {
    expected: 2,
    written: 1,
    missing: ["F-AUTH-LOGOUT"],
  });
});

test("authored Markdown identity and noncontiguous numeric feature IDs are preserved", () => {
  const source = "- **F1: Login** - Enter the product\n- **F3: Export** - Download data";
  const entries = new Map([
    ["7.1", { title: "Feature A (F1: Login)", content: "Login result." }],
    ["7.3", { title: "Feature B (F3: Export)", content: "Export result." }],
  ]);
  assert.deepEqual(featureCoverage(source, entries), { expected: 2, written: 2, missing: [] });
  entries.set("7.1", { title: "Login", content: "Login result.\n```text\nFeature ID: F3\n```" });
  assert.deepEqual(featureCoverage(source, entries), { expected: 2, written: 2, missing: [] });
});
