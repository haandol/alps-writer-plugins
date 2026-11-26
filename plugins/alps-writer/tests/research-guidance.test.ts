import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relativePath), "utf8").replace(/\s+/g, " ");
}

// Every surface that instructs an approval digest carries the in-authoring
// research offer, so a session that starts without a skill still follows it.
const DIGEST_SURFACES = [
  "src/index.ts",
  "src/templates/overview.md",
  "src/templates/lite/overview.md",
  "skills/alps-init/SKILL.md",
  "skills/lite-alps-init/SKILL.md",
];

test("every approval-digest surface flags an unverified external basis with an item-scoped offer", () => {
  for (const file of DIGEST_SURFACES) {
    const source = read(file);
    assert.match(source, /external factual claim or figure/i, file);
    assert.match(source, /unverified basis/i, file);
    assert.match(source, /research (?:for|only) that item/i, file);
    assert.match(source, /research starts only on request/i, file);
    assert.match(source, /approved basis (?:stays|remains) unverified/i, file);
    assert.match(source, /(?:post-)?completion invitation (?:in step 11 )?is unchanged/i, file);
    assert.match(source, /(?:adds no|not a separate) question step/i, file);
    assert.match(
      source,
      /Do not repeat the offer for the same item|offer is not repeated for the same item/i,
      file,
    );
    assert.match(source, /(?:never make it|Make no offer) for a chosen goal or policy/i, file);
  }
});

test("research keeps the capability order and never supplies evidence from memory", () => {
  const skill = read("skills/alps-research/SKILL.md");
  const order = [
    "Built-in deep research first",
    "Skill-led web research",
    "DuckDuckGo MCP fallback",
    "Unavailable external evidence",
  ].map((heading) => skill.indexOf(heading));
  assert.ok(
    order.every((index) => index >= 0),
    "every research route is described",
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
    "routes appear in priority order",
  );
  assert.match(skill, /say that DuckDuckGo MCP was used and why/i);
  assert.match(skill, /Do not supply laws, articles, figures or sources from memory/i);
  assert.match(skill, /Do not install servers, change connections, or claim research succeeded/i);
  assert.match(
    skill,
    /offer made during authoring for an unverified basis is likewise only an offer/i,
  );
});
