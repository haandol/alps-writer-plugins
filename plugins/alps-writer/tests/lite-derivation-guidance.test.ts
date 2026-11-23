import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { TemplateService } from "../src/tools/templates/service.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...segments: string[]) => fs.readFileSync(path.join(ROOT, ...segments), "utf8");
const templates = new TemplateService();

const liteSourceBlock = (section: number): string => {
  const blocks = [
    ...templates.getSectionGuide(section).matchAll(/<lite_source>\n([\s\S]*?)\n<\/lite_source>/g),
  ];
  assert.equal(blocks.length, 1, `guide ${section} has one <lite_source> block`);
  return blocks[0][1];
};

test("every Full Section guide opens its Lite source block with the same rules", () => {
  const preambles = Array.from(
    { length: 9 },
    (_, index) => liteSourceBlock(index + 1).split("\n\n")[0],
  );
  assert.equal(new Set(preambles).size, 1, "the nine preambles are identical");
  const [preamble] = preambles;
  assert.match(
    preamble,
    /alps_section\(action: 'read', doc_path: <the absolute path status reports as `Lite source path:`>, section: N\)/,
  );
  assert.match(
    preamble,
    /never add a business rule, value, permission or user-visible acceptance criterion without a Lite ID/,
  );
  assert.match(preamble, /becomes a Lite change proposal approved and saved in the Lite document/);
});

test("Full NFR and metric guides route undefined business conditions and settled tensions to Lite", () => {
  assert.match(
    liteSourceBlock(5),
    /When a Lite NFR leaves its population or observation condition undefined \(for example an undefined peak period\), do not define it in Full: ask it as a Lite change proposal, and keep the Full NFR to how the defined target is measured\./,
  );
  const tension =
    /Propose a tension candidate only for a KPI without a recorded tension decision, as a Lite change proposal/;
  assert.match(liteSourceBlock(2), tension);
  assert.match(liteSourceBlock(8), tension);
  assert.match(
    liteSourceBlock(8),
    /a KPI whose Lite row records a TM, guarding IDs or non-adoption gets no new candidate/,
  );

  const overview = templates.getOverview();
  assert.match(
    overview,
    /Lite NFR leaves its population or observation condition undefined, do not define it in Full; ask\s+it as a Lite change proposal/,
  );
  assert.match(
    overview,
    /Propose a tension candidate only for a KPI whose Lite row records no tension\s+decision/,
  );
  assert.match(
    read("skills", "alps-init", "SKILL.md"),
    /With a Lite source, propose a candidate only for a KPI whose Lite row records no tension decision, as a Lite change proposal\./,
  );
});

test("an unusable source or incomplete document is always followed by its next steps", () => {
  const overview = templates.getOverview();
  assert.match(overview, /Read Lite with the absolute path status reports as `Lite source path:`/);
  assert.match(
    overview,
    /If status reports the Lite source as unavailable or incomplete, Lite coverage is unverified and the document\s+is not complete; resume, saves and export still work\. Never stop at the blocked state: relay the\s+`Next steps:` status lists/,
  );
  assert.doesNotMatch(
    overview,
    /until the Lite document is restored at the recorded relative path/,
  );

  const alpsInit = read("skills", "alps-init", "SKILL.md");
  assert.match(
    alpsInit,
    /report the reason \(for example an incomplete Lite\) with the next action the server names/,
  );
  assert.match(
    alpsInit,
    /when it reports the source unavailable or incomplete, relay its `Next steps:` and offer to restore or complete the Lite/,
  );
  assert.match(
    read("skills", "lite-alps-init", "SKILL.md"),
    /While it\s+reports incomplete, relay the `Next steps:` it lists and offer to do the next one\. Once it\s+reports complete, ask once whether the user wants an optional deep-research review/,
  );
  assert.match(
    read("src", "index.ts"),
    /never stop at the blocked state: relay the \\`Next steps:\\` it lists and offer to do the next one\./,
  );
});
