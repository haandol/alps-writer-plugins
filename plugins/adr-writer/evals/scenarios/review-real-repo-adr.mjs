// Scenario: review an ADR from a REAL repository, not a synthetic fixture.
//
// The other scenarios build a fixture containing one planted defect, which makes
// scoring sharp but keeps the input tidier than anything real. A shipped ADR is
// messier: it mixes genuine requirement values with implementation detail that
// crept in, cites function names, and often predates half the rules. That mix is
// where the requirement-vs-detail call actually gets hard, so this scenario
// points the reviewer at a real one.
//
// Usage:
//   ADR_EVAL_REPO=~/git/pixelbank \
//   ADR_EVAL_ADR=docs/adr/token/0002-free-trial.md \
//     node evals/run.mjs --only review-real-repo-adr --runs 3
//
// Scoring here is necessarily thinner than in a planted-defect scenario: nobody
// knows the full correct answer for a real ADR. So it checks the two things that
// are knowable regardless of content —
//   1. values the reviewer must never propose deleting (ADR_EVAL_VALUES), and
//   2. that the report is well-formed and reaches a verdict at all
// — and prints the findings for a human to read. A real-repo run is a
// reproduction aid, not a graded exam.
import { readFileSync, existsSync, copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { agentText, seedRuleDocs, write, TAIL_SPEC } from "../lib/harness.mjs";

const REPO = expandHome(process.env.ADR_EVAL_REPO ?? "");
const ADR_REL = process.env.ADR_EVAL_ADR ?? "";

function expandHome(p) {
  return p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p;
}

export default {
  name: "review-real-repo-adr",
  description:
    "Review an ADR from a real repo (ADR_EVAL_REPO + ADR_EVAL_ADR). Checks that named requirement values survive; findings are printed for a human to read.",

  build(dir) {
    if (!REPO || !ADR_REL) {
      throw new Error(
        `set ADR_EVAL_REPO and ADR_EVAL_ADR, e.g.\n` +
          `  ADR_EVAL_REPO=~/git/pixelbank ADR_EVAL_ADR=docs/adr/token/0002-free-trial.md`,
      );
    }
    const source = path.join(REPO, ADR_REL);
    if (!existsSync(source)) throw new Error(`no such ADR: ${source}`);

    // Copy the ADR and its sibling category (Related links point at siblings, so
    // R10 needs them) into a throwaway dir. The real repo is never written to.
    const category = path.dirname(ADR_REL);
    mkdirSync(path.join(dir, category), { recursive: true });
    for (const f of readdirSync(path.join(REPO, category))) {
      if (f.endsWith(".md")) {
        copyFileSync(path.join(REPO, category, f), path.join(dir, category, f));
      }
    }

    // Then follow the ADR's own relative links and copy whatever they point at.
    // Without this, R10 fires on every link that leaves docs/adr/ — a snapshot
    // artifact, not a defect in the ADR. The first real-repo run reported the
    // FREE_USAGE.md link as broken when the file exists; a fixture that
    // manufactures findings wastes the reviewer's attention and, worse, teaches
    // the reader to discount R10 results.
    copyLinkTargets(REPO, dir, ADR_REL);

    // The repo's own rule docs if it has them, otherwise the shipped ones — the
    // reviewer must judge against what that project actually holds.
    seedRuleDocs(dir);
    for (const doc of ["README.md", "concepts.md", "authoring-rules.md", "structure.md"]) {
      const own = path.join(REPO, "docs", "adr", doc);
      if (existsSync(own)) copyFileSync(own, path.join(dir, "docs", "adr", doc));
    }

    const realMapping = path.join(REPO, "docs", "adr", ".mapping.json");
    if (existsSync(realMapping)) {
      copyFileSync(realMapping, path.join(dir, "docs", "adr", ".mapping.json"));
    } else {
      write(dir, "docs/adr/.mapping.json", JSON.stringify({ categories: {} }, null, 2) + "\n");
    }

    return [
      agentText("adr-reviewer"),
      `\n---\n\n# This run\n`,
      `You are running as the adr-reviewer agent described above, in the repository at ${dir}.`,
      `Review this ADR: ${ADR_REL}`,
      `Its mapping entry, if present, is in docs/adr/.mapping.json.`,
      `No deterministic harness result is being passed, so evaluate the rules yourself.`,
      `Read the rule documents under docs/adr/ as your source of truth.`,
      `This is a real shipped ADR: expect it to predate some rules. Report what you find.`,
      TAIL_SPEC,
    ].join("\n");
  },
};

// Copy every existing local file the ADR links to, preserving its path relative
// to the repo root so the link still resolves inside the fixture. Skips URLs,
// anchors, and anything already copied with the category. One level deep: a
// linked doc's own links are not followed, since the reviewer only checks that
// THIS ADR's targets resolve.
function copyLinkTargets(repo, dir, adrRel) {
  const body = readFileSync(path.join(repo, adrRel), "utf8");
  const adrDir = path.dirname(adrRel);
  for (const [, target] of body.matchAll(/\]\(([^)]+)\)/g)) {
    const clean = target.split("#")[0].trim();
    if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith("//")) continue;
    // Resolve relative to the ADR, then keep it repo-relative.
    const rel = path.normalize(path.join(adrDir, clean));
    if (rel.startsWith("..")) continue; // outside the repo — nothing to copy
    const from = path.join(repo, rel);
    const to = path.join(dir, rel);
    if (!existsSync(from) || existsSync(to)) continue;
    try {
      if (statSync(from).isDirectory()) continue;
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
    } catch {
      /* unreadable target — leave it absent, which is a real broken link */
    }
  }
}
