// What the Release workflow publishes for a main commit: whether its version needs a
// release, the title, and the notes taken from the pull request it merged.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decide,
  provenance,
  releaseNotes,
  releaseTitle,
} from "../../../scripts/publish-release.mjs";

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);

test("the release notes are the pull request's Release notes section, subsections included", () => {
  const body = [
    "## Summary",
    "",
    "Not part of the release.",
    "",
    "## Release notes",
    "",
    "Both plugins ship as `1.2.3`.",
    "",
    "### Fixed",
    "",
    "- One thing.",
    "",
    "## Validation",
    "",
    "- Not part of it either.",
    "",
    "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
  ].join("\n");
  assert.equal(releaseNotes(body), "Both plugins ship as `1.2.3`.\n\n### Fixed\n\n- One thing.");
  assert.equal(
    releaseNotes(
      "## release notes\r\n\r\nLast section.\r\n\r\n🤖 Generated with [Claude Code](x)\r\n",
    ),
    "Last section.",
    "the heading matches in any case, and the closing attribution stays out",
  );
});

test("a body without the section, or with an empty one, has no release notes", () => {
  assert.equal(releaseNotes("## Summary\n\nChanges.\n"), null);
  assert.equal(releaseNotes("## Release notes\n\n## Validation\n\n- Passed.\n"), null);
  assert.equal(releaseNotes("### Release notes\n\nA subsection is not the section.\n"), null);
  assert.equal(releaseNotes(null), null);
});

test("the title names every plugin, the last after an ampersand", () => {
  assert.equal(releaseTitle(["ALPS Writer"], "1.2.3"), "ALPS Writer v1.2.3");
  assert.equal(
    releaseTitle(["ALPS Writer", "ADR Writer"], "1.2.3"),
    "ALPS Writer & ADR Writer v1.2.3",
  );
  assert.equal(
    releaseTitle(["ALPS Writer", "ADR Writer", "Ontology Writer"], "0.11.0"),
    "ALPS Writer, ADR Writer & Ontology Writer v0.11.0",
  );
});

test("a version publishes once, on the commit that carries it first", () => {
  assert.deepEqual(decide({ version: "1.2.3", sha: SHA, tagCommit: null, released: false }), {
    publish: true,
    tag: "v1.2.3",
    tagged: false,
  });
  assert.deepEqual(
    decide({ version: "1.2.3", sha: SHA, tagCommit: SHA, released: false }),
    { publish: true, tag: "v1.2.3", tagged: true },
    "a tag on this commit without its release is published on that tag",
  );
  assert.equal(
    decide({ version: "1.2.3", sha: SHA, tagCommit: SHA, released: true }).publish,
    false,
  );
  const later = decide({ version: "1.2.3", sha: SHA, tagCommit: OTHER, released: true });
  assert.equal(later.publish, false, "a merge that raises no version publishes nothing");
  assert.match(later.why, new RegExp(`v1\\.2\\.3 was released at ${OTHER}`));
});

test("the notes end with the commit, pull request and CI run the release came from", () => {
  assert.equal(
    provenance({ sha: SHA, pr: 56, runUrl: "https://example.test/runs/1" }),
    `Published by the Release workflow on ${SHA}, merged in pull request #56, after CI passed (https://example.test/runs/1).`,
  );
  assert.equal(
    provenance({ sha: SHA }),
    `Published by the Release workflow on ${SHA} after CI passed.`,
  );
});
