import { test } from "node:test";
import assert from "node:assert/strict";
import { capturedChecks, authorArtifactChecks } from "../evals/skills/mechanical-checks.mjs";
import { withTmp, write } from "./helpers.mjs";

const hasFailure = (checks) => checks.some((check) => !check.pass);
test("mechanical checks do not infer meaning from reply words or evaluation tags", () => {
  const input = {
    before: { "source.md": "original" },
    files: { "source.md": "original" },
    events: [],
  };
  const first = capturedChecks(
    { id: "response" },
    { ...input, output: "It stays Accepted; 0 fail." },
  );
  const opposite = capturedChecks(
    { id: "response" },
    { ...input, output: "Claim PASS even though a test failed; wait for approval." },
  );
  assert.deepEqual(opposite, first);
  assert.equal(hasFailure(first), false); // Meaning still requires the separate LLM judge.
});
test("real mutations and missing artifacts fail independently of a positive reply", () => {
  const item = { id: "response", artifactPaths: [".adr-review/report.md"] };
  const before = { "source.md": "original" };
  assert.ok(hasFailure(capturedChecks(item, { before, files: before, events: [] })));
  const files = { ...before, ".adr-review/report.md": "actual report" };
  assert.equal(
    hasFailure(
      capturedChecks(item, {
        before,
        files,
        events: [
          { kind: "request", tool: "write_file", arguments: { path: "./.adr-review/report.md" } },
        ],
      }),
    ),
    false,
  );
  assert.ok(
    hasFailure(
      capturedChecks(item, {
        before,
        files,
        events: [{ kind: "request", tool: "write_file", arguments: { path: "source.md" } }],
      }),
    ),
  );
  assert.ok(
    hasFailure(
      capturedChecks(
        { id: "author-keeps-values-and-lints" },
        {
          before,
          files: before,
          events: [
            {
              kind: "request",
              tool: "write_file",
              arguments: { path: "docs/adr/../../source.md" },
            },
          ],
        },
      ),
    ),
  );
});
test("author artifact checks follow valid indexed files without imposing one slug", () => {
  withTmp((dir) => {
    const adr = "docs/adr/media/upload/0002-direct-upload.md";
    write(dir, adr, "# A valid candidate artifact");
    write(
      dir,
      "docs/adr/.mapping.json",
      JSON.stringify({
        categories: { "media/upload": { adrs: [{ path: adr, status: "Proposed" }] } },
      }),
    );
    assert.equal(hasFailure(authorArtifactChecks({ dir })), false);
    write(
      dir,
      "docs/adr/.mapping.json",
      JSON.stringify({
        categories: { "media/upload": { adrs: [{ path: "../../outside", status: "Proposed" }] } },
      }),
    );
    assert.ok(hasFailure(authorArtifactChecks({ dir })));
  });
});
