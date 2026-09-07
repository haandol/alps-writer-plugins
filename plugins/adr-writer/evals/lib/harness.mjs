// harness.mjs — build a throwaway repo, invoke a REAL skill/agent definition in
// a headless agent, and score what comes back.
//
// The point of passing the actual SKILL.md, scenario-selected Markdown
// references, and agents/*.md text is that a reconstructed prompt would test
// this file's summary of the rules rather than the rules that ship.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SEEDED_RULE_DOCS } from "../../scripts/adr-lint-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = path.resolve(HERE, "..", "..");
export const ALPS_PLUGIN_ROOT = path.resolve(PLUGIN_ROOT, "..", "alps-writer");
export const TEMPLATES = path.join(PLUGIN_ROOT, "templates", "adr");
export const STRUCTURE_LINT = path.join(PLUGIN_ROOT, "scripts", "adr-structure-lint.mjs");
export const ADR_HOOK = path.join(PLUGIN_ROOT, "hooks", "surface-adr-context.mjs");
export const IMPL_REVIEW_VALIDATE = path.join(
  PLUGIN_ROOT,
  "scripts",
  "adr-impl-review-validate.mjs",
);
export const IMPL_REVIEW_MATERIALIZE = path.join(
  PLUGIN_ROOT,
  "scripts",
  "adr-impl-review-materialize.mjs",
);
export const IMPL_REVIEW_REPORT = path.join(PLUGIN_ROOT, "scripts", "adr-impl-review-report.mjs");

// The seeded rule docs a real repo holds. Fixtures get the real files, not
// stubs — several rules are only judgeable against them, and a scenario that
// stubbed them would silently measure the stub. Taken from the lint lib so a
// scenario is scored against the same doc set the shipped harness reads.
const RULE_DOCS = SEEDED_RULE_DOCS;

export function mkFixture(prefix = "adr-eval-") {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

export function write(dir, rel, content) {
  const full = path.join(dir, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}

export function read(dir, rel) {
  try {
    return readFileSync(path.join(dir, rel), "utf8");
  } catch {
    return null;
  }
}

export function seedRuleDocs(dir) {
  for (const f of RULE_DOCS) {
    copyFileSync(path.join(TEMPLATES, f), write(dir, `docs/adr/${f}`, ""));
  }
}

export function seedMapping(dir, mapping = { categories: {} }) {
  write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2) + "\n");
}

export function validateReviewArtifact(dir, report, findings) {
  const artifactDir = path.join(dir, "review-artifact");
  const reportPath = write(artifactDir, "implementation-review.md", report);
  const explanationPath = write(
    artifactDir,
    "explanation.md",
    `# Implementation explanation

## Context
The implementation must preserve the reviewed ADR decision and contract. The supplied scenario defines the surrounding conditions, contract baseline, scope, and verification limits.

## The reviewed behavior reaches its observable result
The verified path follows the supplied evidence and tests through the contract boundary.

## Failure remains inside the decided boundary
The scenario evidence identifies the relevant failure result without inventing another flow.
`,
  );
  const atAGlance = {};
  for (const field of ["impact", "action", "risk"]) {
    const match = report.match(new RegExp(`^[-*]\\s+${field}:\\s*(.+)$`, "im"));
    atAGlance[field] = match?.[1]?.trim() || "";
  }
  const findingsPath = write(
    artifactDir,
    "findings.json",
    JSON.stringify(
      {
        ...findings,
        atAGlance: findings.atAGlance ?? atAGlance,
        report: reportPath,
        explanation: explanationPath,
      },
      null,
      2,
    ) + "\n",
  );
  const materialized = spawnSync(process.execPath, [IMPL_REVIEW_MATERIALIZE, artifactDir], {
    cwd: dir,
    encoding: "utf8",
  });
  if (materialized.status !== 0) {
    return {
      pass: false,
      detail: materialized.stderr.trim() || materialized.stdout.trim() || "materializer failed",
    };
  }
  const validation = spawnSync(process.execPath, [IMPL_REVIEW_VALIDATE, artifactDir], {
    cwd: dir,
    encoding: "utf8",
  });
  if (validation.status !== 0) {
    return {
      pass: false,
      detail: validation.stderr.trim() || validation.stdout.trim() || "validator failed",
    };
  }

  const rendered = spawnSync(process.execPath, [IMPL_REVIEW_REPORT, findingsPath, "--stdout"], {
    cwd: dir,
    encoding: "utf8",
  });
  return {
    pass: rendered.status === 0,
    detail:
      rendered.status === 0
        ? "artifact validator and HTML renderer passed"
        : rendered.stderr.trim() || "HTML renderer failed",
    html: rendered.stdout,
    report: read(artifactDir, "implementation-review.md"),
  };
}

// The instruction text of a real skill or agent, minus its YAML frontmatter
// (the frontmatter is client registration metadata, not instructions).
export function skillText(name, options = {}) {
  return promptText(path.join(PLUGIN_ROOT, "skills", name, "SKILL.md"), PLUGIN_ROOT, options);
}

export function alpsSkillText(name, options = {}) {
  return promptText(
    path.join(ALPS_PLUGIN_ROOT, "skills", name, "SKILL.md"),
    ALPS_PLUGIN_ROOT,
    options,
  );
}

export function alpsGuideText(section) {
  return readFileSync(
    path.join(ALPS_PLUGIN_ROOT, "src", "guides", `${String(section).padStart(2, "0")}.md`),
    "utf8",
  );
}

export function alpsLiteGuideText(section) {
  return readFileSync(
    path.join(ALPS_PLUGIN_ROOT, "src", "guides", "lite", `${String(section).padStart(2, "0")}.md`),
    "utf8",
  );
}

/**
 * Produces the real Lite resume response from the shipping DocumentService so
 * behavior evals exercise runtime guidance rather than a copied prompt.
 */
export function alpsLiteResumeText(dir) {
  const target = path.join(dir, "resume.lite.alps.xml");
  const script = [
    'import { DocumentService } from "./src/tools/documents/service.ts";',
    `const target = ${JSON.stringify(target)};`,
    "const author = new DocumentService();",
    'author.initDocument("resume", target, "lite");',
    "const resumed = new DocumentService();",
    "process.stdout.write(resumed.loadDocument(target));",
  ].join("\n");
  const result = spawnSync("pnpm", ["--filter", "alps-writer", "exec", "tsx", "-e", script], {
    cwd: path.resolve(ALPS_PLUGIN_ROOT, "..", ".."),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `unable to produce Lite resume guidance: ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  return result.stdout.trim();
}

export function agentText(name, options = {}) {
  return promptText(path.join(PLUGIN_ROOT, "agents", `${name}.md`), PLUGIN_ROOT, options);
}

export function ruleText(name) {
  if (!RULE_DOCS.includes(name)) throw new Error(`unknown seeded rule document: ${name}`);
  return readFileSync(path.join(TEMPLATES, name), "utf8");
}

function stripFrontmatter(source) {
  return source.replace(/^---\n[\s\S]*?\n---\n/, "");
}

function promptText(entryPath, pluginRoot, { references = [] } = {}) {
  if (!Array.isArray(references)) {
    throw new TypeError("prompt references must be an array");
  }

  const source = readFileSync(entryPath, "utf8");
  const entryDir = path.dirname(entryPath);
  const available = new Map(
    directMarkdownReferences(source, entryDir, pluginRoot).map((reference) => [
      path.relative(pluginRoot, reference).split(path.sep).join("/"),
      reference,
    ]),
  );
  const parts = [stripFrontmatter(source)];

  for (const requested of references) {
    const key = requested.split(path.sep).join("/");
    const reference = available.get(key);
    if (!reference) {
      throw new Error(
        `${key} is not directly referenced by ${path.relative(pluginRoot, entryPath)}`,
      );
    }
    parts.push(`\n# Loaded reference: ${key}\n`);
    parts.push(readFileSync(reference, "utf8"));
  }

  return parts.join("\n");
}

function directMarkdownReferences(source, skillDir, pluginRoot) {
  const files = new Set();
  for (const match of source.matchAll(/`([^`\n]*references\/[^`\n]+\.md)`/g)) {
    const reference = match[1];
    const full = reference.startsWith("${CLAUDE_PLUGIN_ROOT}/")
      ? path.join(pluginRoot, reference.slice("${CLAUDE_PLUGIN_ROOT}/".length))
      : path.join(skillDir, reference);
    files.add(full);
  }
  return [...files];
}

// Scoring needs a fixed shape to read, and free-form prose is where a scorer
// starts guessing. So every scenario appends this block request — the agent
// writes its normal report first, then repeats its conclusions in one parseable
// tail. This IS a deviation from a real run; see README "What this does not
// prove".
export const TAIL_SPEC = `
---

## Machine-readable tail (required)

After your normal report above, repeat your conclusions in exactly this block so
an automated scorer can read them. Use the same category and rule names you used
above — do not soften or re-label them here.

\`\`\`
=== EVAL-VERDICT: <your verdict> ===
=== EVAL-FINDINGS ===
<category or rule id> | <one-line summary, including any value or name at issue>
<one line per finding; write NONE on a single line if you found none>
=== EVAL-END ===
\`\`\`
`;

// Pull the tail block out. Returns {verdict, findings:[{tag, summary}], raw}.
// A missing block is itself a result (the agent ignored a format instruction),
// so this never throws.
export function parseTail(output) {
  const verdict = output.match(/===\s*EVAL-VERDICT:\s*(.+?)\s*===/)?.[1]?.trim() ?? null;
  const bodyMatch = output.match(/===\s*EVAL-FINDINGS\s*===([\s\S]*?)===\s*EVAL-END\s*===/);
  const body = bodyMatch?.[1] ?? "";
  const findings = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "NONE" && !l.startsWith("```"))
    .map((line) => {
      const i = line.indexOf("|");
      return i === -1
        ? { tag: line, summary: "" }
        : { tag: line.slice(0, i).trim(), summary: line.slice(i + 1).trim() };
    });
  return { complete: Boolean(verdict && bodyMatch), verdict, findings, raw: output };
}

// ── scoring helpers ───────────────────────────────────────────────────────
// Each returns {pass, detail} so a failing check explains itself without the
// reader opening the transcript.

export function findingMatching(tail, tagPattern) {
  return tail.findings.filter((f) => tagPattern.test(f.tag));
}

export function expectFinding(tail, tagPattern, label) {
  const hits = findingMatching(tail, tagPattern);
  return {
    pass: hits.length > 0,
    detail: hits.length
      ? hits.map((h) => `${h.tag} | ${h.summary}`).join(" ; ")
      : `no finding tagged ${tagPattern} (saw: ${tail.findings.map((f) => f.tag).join(", ") || "none"})`,
    label,
  };
}

export function expectNoFinding(tail, tagPattern, label) {
  const hits = findingMatching(tail, tagPattern);
  return {
    pass: hits.length === 0,
    detail: hits.length
      ? `unexpected: ${hits.map((h) => `${h.tag} | ${h.summary}`).join(" ; ")}`
      : "absent, as required",
    label,
  };
}

// The miscategorization check this plugin cares most about: the right subject
// filed under the wrong category. Scored on the finding line that mentions the
// subject, so an unrelated finding with that category does not trip it.
export function expectNotMiscategorized(tail, subjectPattern, wrongTagPattern, label) {
  const bad = tail.findings.filter(
    (f) => subjectPattern.test(`${f.tag} ${f.summary}`) && wrongTagPattern.test(f.tag),
  );
  return {
    pass: bad.length === 0,
    detail: bad.length
      ? `filed under the wrong category: ${bad.map((h) => `${h.tag} | ${h.summary}`).join(" ; ")}`
      : "not miscategorized",
    label,
  };
}

export function expectText(haystack, pattern, label) {
  const ok = pattern.test(haystack ?? "");
  return { pass: ok, detail: ok ? `matched ${pattern}` : `missing ${pattern}`, label };
}

export function expectNoText(haystack, pattern, label) {
  const hit = (haystack ?? "").match(pattern);
  return {
    pass: !hit,
    detail: hit ? `found forbidden ${pattern}: "${hit[0]}"` : `absent, as required`,
    label,
  };
}

export function hookContext(dir, mapping = { categories: {} }) {
  seedMapping(dir, mapping);
  const result = spawnSync(process.execPath, [ADR_HOOK], {
    cwd: dir,
    input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup" }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
  if (result.status !== 0) {
    throw new Error(`hook failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout).hookSpecificOutput?.additionalContext ?? "";
}

// Run the shipped deterministic harness over the fixture. Used by author-side
// scenarios: an ADR the agent wrote must survive the same lint a real one does.
export function lint(dir, args = ["--no-invariants", "--json"]) {
  const r = spawnSync("node", [STRUCTURE_LINT, ...args], {
    cwd: dir,
    encoding: "utf8",
  });
  let parsed = null;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    /* non-JSON output (usage error) — leave null */
  }
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, report: parsed };
}

export function expectLintClean(dir, label = "structure-lint reports no error") {
  const { code, report, stdout } = lint(dir);
  const errors = report?.errors ?? [];
  return {
    pass: code === 0 && errors.length === 0,
    detail:
      code === 0 && errors.length === 0
        ? "clean"
        : `exit ${code}; errors: ${errors.map((e) => e.rule).join(", ") || stdout.slice(0, 200)}`,
    label,
  };
}

// ── agent invocation ──────────────────────────────────────────────────────
// The command is configurable because this plugin ships for two clients and
// models are replaced faster than this file. Default targets Claude Code
// headless mode. The prompt goes on stdin so a large fixture cannot hit an
// argv length limit.
export const DEFAULT_CMD = process.env.ADR_EVAL_CMD ?? "claude -p --allowedTools ''";

export function runAgent(prompt, { cmd = DEFAULT_CMD, cwd, timeoutMs = 600_000 } = {}) {
  const started = performance.now();
  const r = spawnSync(cmd, {
    shell: true,
    input: prompt,
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    ok: r.status === 0 && !r.error,
    status: r.status,
    error: r.error ? String(r.error.message ?? r.error) : null,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    ms: performance.now() - started,
  };
}
