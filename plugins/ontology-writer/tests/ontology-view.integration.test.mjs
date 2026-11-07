// Read-only process views: landscape, process
// flows and element details from the same model reading as validation and
// queries, with realization computed from the ADR index at generation time.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { openerCommand } from "../scripts/adr-impl-review-open.mjs";
import { checkRealizes } from "../scripts/ontology-lib.mjs";
import { renderView } from "../scripts/ontology-view.mjs";
import { commitAll, git, initRepo, withTmp, write, writeAdrFiles } from "./helpers.mjs";
import { CLI, EXAMPLE } from "./ontology-helpers.mjs";
import {
  MAPPING,
  sections,
  v,
  withoutEngine,
  anchorOf,
  decodeAnchor,
  articleOf,
  landscapeOf,
  diagrams,
  UNKNOWN,
  assertNoUnrealizedStep,
} from "./ontology-view-helpers.mjs";

function cli(dir, args, env = {}) {
  try {
    return {
      code: 0,
      out: execFileSync(process.env.ONTOLOGY_TEST_RUNTIME ?? process.execPath, [CLI, ...args], {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, ...env },
      }),
    };
  } catch (e) {
    return { code: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

test("a view run directory is named by the local time, as the other review runs are", () => {
  withTmp((dir) => {
    initRepo(dir);
    // Nine hours from UTC, so a name taken from UTC cannot match by chance.
    const probe = `
      const { allocateRunDirectory } = await import(${JSON.stringify(pathToFileURL(path.join(path.dirname(CLI), "ontology-fs.mjs")).href)});
      const two = (n) => String(n).padStart(2, "0");
      const stamp = (d) => \`\${d.getFullYear()}\${two(d.getMonth() + 1)}\${two(d.getDate())}-\${two(d.getHours())}\${two(d.getMinutes())}\${two(d.getSeconds())}\`;
      const before = stamp(new Date());
      const { dir } = allocateRunDirectory(process.cwd(), "ontology-view");
      console.log(JSON.stringify({ name: dir.split("/").pop(), before, after: stamp(new Date()) }));
    `;
    const { name, before, after } = JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "-e", probe], {
        cwd: dir,
        env: { ...process.env, TZ: "Asia/Seoul" },
        encoding: "utf8",
      }),
    );
    assert.ok(
      name.startsWith(`${before}-ontology-view-`) || name.startsWith(`${after}-ontology-view-`),
      `${name} vs ${before}..${after}`,
    );
  });
});

test("the CLI writes one ignored file, opens it on request, and creates nothing without a model", () => {
  withTmp((dir) => {
    initRepo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING));
    commitAll(dir);
    const none = cli(dir, ["view", "--no-open"]);
    assert.equal(none.code, 1);
    assert.match(none.out, /no ontology in docs\/ontology; no view was created/);

    write(dir, "docs/ontology/model.ttl", EXAMPLE);
    commitAll(dir, "model");
    const before = git(dir, ["status", "--porcelain"]);
    const out = cli(dir, ["view", "--no-open"]);
    assert.equal(out.code, 0, out.out);
    const file = /NOT_OPENED (\S+) — opening was not requested/.exec(out.out)[1];
    assert.ok(path.isAbsolute(file) && file.includes(`${path.sep}.adr-review${path.sep}`), file);
    assert.match(readFileSync(file, "utf8"), /^<!doctype html>/);
    assert.equal(
      git(dir, ["status", "--porcelain"]),
      before,
      "no tracked change and no new untracked file",
    );
    assert.equal(readdirSync(path.dirname(file)).join(), "ontology-view.html");

    const failed = cli(dir, ["view", "--browser", "no-such-browser-for-ontology-writer-tests"]);
    assert.match(
      failed.out,
      /NOT_OPENED \/\S+ontology-view\.html — /,
      "the absolute path and the actual reason are reported",
    );
  });
});

test("the CLI view says why change flags are unavailable when the committed model cannot be parsed", () => {
  withTmp((dir) => {
    initRepo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING));
    write(dir, "docs/ontology/model.ttl", "m:x a [ ] .\n");
    commitAll(dir);
    write(dir, "docs/ontology/model.ttl", EXAMPLE);
    const out = cli(dir, ["view", "--no-open"]);
    const file = /NOT_OPENED (\S+) — opening was not requested/.exec(out.out)?.[1];
    assert.ok(file, out.out);
    assert.match(
      readFileSync(file, "utf8"),
      /<h2>Change flags unavailable<\/h2><p>[^<]+: the committed model cannot be parsed<\/p>/,
    );
  });
});

/** A stand-in for the host opener and a browser: it records each call and fails on request. */
const STUB_OPENER = `#!/bin/sh
printf '%s\\n' "$(basename "$0") $*" >> "$ONTOLOGY_WRITER_TEST_OPEN_LOG"
if [ -n "$ONTOLOGY_WRITER_TEST_OPEN_FAIL" ]; then printf '%s\\n' "$ONTOLOGY_WRITER_TEST_OPEN_FAIL" >&2; exit 1; fi
`;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The opener call the host makes for the view, with the file URL left open. */
const openerCall = (browser = null) => {
  const command = openerCommand("URL", process.platform, browser);
  return new RegExp(
    `^${[command.command, ...command.args].map((a) => (a === "URL" ? "(file:\\S+)" : escapeRegExp(a))).join(" ")}$`,
  );
};

test(
  "the CLI view opens once by default, never with --no-open, and once in a named browser whose failure it explains",
  {
    skip:
      !["open", "xdg-open"].includes(openerCommand("URL")?.command) &&
      "the host opener cannot be replaced by a stub on this platform",
  },
  () => {
    withTmp((root) => {
      const dir = path.join(root, "repo");
      const bin = path.join(root, "bin");
      const log = path.join(root, "open.log");
      for (const name of ["open", "xdg-open", "ontology-writer-test-browser"])
        chmodSync(write(bin, name, STUB_OPENER), 0o755);
      const env = {
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        ONTOLOGY_WRITER_TEST_OPEN_LOG: log,
      };
      const calls = () =>
        existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
      write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING));
      write(dir, "docs/ontology/model.ttl", EXAMPLE);
      initRepo(dir);
      commitAll(dir);

      const opened = cli(dir, ["view"], env);
      const file = /^OPENED (\S+)$/m.exec(opened.out)?.[1];
      assert.ok(file, opened.out);
      assert.equal(calls().length, 1, "the default browser is opened once");
      const url = openerCall().exec(calls()[0])?.[1] ?? "";
      assert.ok(url.startsWith(`${pathToFileURL(file).href}?v=`), calls()[0]);

      assert.match(
        cli(dir, ["view", "--no-open"], env).out,
        /NOT_OPENED \S+ — opening was not requested/,
      );
      assert.equal(calls().length, 1, "--no-open opens nothing");

      const failed = cli(dir, ["view", "--browser", "ontology-writer-test-browser"], {
        ...env,
        ONTOLOGY_WRITER_TEST_OPEN_FAIL:
          "Unable to find application named 'ontology-writer-test-browser'",
      });
      assert.equal(calls().length, 2, "the named browser is tried once");
      assert.match(calls()[1], openerCall("ontology-writer-test-browser"));
      assert.match(
        failed.out,
        /^NOT_OPENED \/\S+\/ontology-view\.html — \S+ exited with status 1: Unable to find application named 'ontology-writer-test-browser'$/m,
      );
    });
  },
);

test("index-link errors belong to their category and an unreadable index is shown, as in validation and queries", () => {
  const mapping = structuredClone(MAPPING);
  const [category] = Object.keys(mapping.categories);
  mapping.categories[category].realizes = ["ordering.order-placed"];
  const findings = [...v.findings, ...checkRealizes(mapping, v.index)];
  assert.ok(findings.some((f) => f.code === "ontology-link-dangling"));
  const html = withoutEngine(renderView({ index: v.index, mapping, findings }));
  assert.match(html, /<section class="errors"[\s\S]*ontology-link-dangling/);
  assert.doesNotMatch(articleOf(html, "ordering.order-placed"), /badge broken|· error/);
  for (const d of diagrams(html))
    for (const [, n] of d.nodes) assert.ok(!n.classes.includes("broken"), n.label);

  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2).slice(0, 80));
    write(dir, "docs/ontology/model.ttl", EXAMPLE);
    const out = cli(dir, ["view", "--no-open"]);
    const file = /NOT_OPENED (\S+) — opening was not requested/.exec(out.out)?.[1];
    assert.ok(file, out.out);
    const page = readFileSync(file, "utf8");
    assert.match(page, /<section class="errors"[\s\S]*ontology-index-unreadable/);
    // Every flow is incomplete with exactly the errors its process query lists, the
    // landscape is incomplete, and no system step is said to lack a realizing feature.
    const flows = sections(page);
    assert.ok(flows.length >= 2);
    for (const s of flows) {
      const id = decodeAnchor(s.id);
      const q = JSON.parse(cli(dir, ["query", "--process", id, "--json"]).out);
      assert.equal(q.complete, false, id);
      assert.match(s.body, /class="incomplete"[\s\S]*ontology-index-unreadable/, id);
      const listed = [...s.body.matchAll(/<li><code>([^<]+)<\/code> <code>([^<]+)<\/code>/g)];
      assert.deepEqual(
        listed.map((m) => `${m[1]} ${m[2]}`).sort(),
        q.errors.map((e) => `${e.code} ${e.where}`).sort(),
        `${id}: the errors of the query`,
      );
    }
    assert.match(landscapeOf(page), /class="incomplete"/);
    assertNoUnrealizedStep(page);
    // A system step's details lead to the index error; an outside step keeps its label.
    assert.match(
      articleOf(page, "ordering.submit-order"),
      /<a href="#errors">cannot be determined until the ADR index error is fixed<\/a>/,
    );
    assert.match(
      articleOf(page, "payment.capture-payment"),
      /outside the system — not realized by a feature/,
    );
  });
});

test("the CLI view and query treat an ADR whose body Status differs from its index record alike", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    write(dir, "docs/ontology/model.ttl", EXAMPLE);
    write(dir, "docs/adr/checkout/0001-a.md", "# ADR 0001: a\n\n## Status\n\nProposed\n");
    const out = cli(dir, ["view", "--no-open"]);
    const file = /NOT_OPENED (\S+) — opening was not requested/.exec(out.out)?.[1];
    assert.ok(file, out.out);
    const page = readFileSync(file, "utf8");
    assert.match(articleOf(page, "ordering.submit-order"), UNKNOWN);
    const query = JSON.parse(
      cli(dir, ["query", "--process", "ordering.place-order", "--json"]).out,
    );
    assert.equal(query.complete, false);
    assert.ok(query.errors.some((e) => e.code === "ontology-adr-status-mismatch"));
  });
});

test("the CLI view shows the steps of a feature whose indexed ADR file is missing as undeterminable, leading to the errors list", () => {
  withTmp((dir) => {
    initRepo(dir);
    write(dir, "docs/adr/.mapping.json", JSON.stringify(MAPPING, null, 2));
    write(dir, "docs/ontology/model.ttl", EXAMPLE);
    writeAdrFiles(dir, MAPPING);
    commitAll(dir);
    rmSync(path.join(dir, "docs/adr/checkout/0001-a.md"));
    const out = cli(dir, ["view", "--no-open"]);
    const file = /NOT_OPENED (\S+) — opening was not requested/.exec(out.out)?.[1];
    assert.ok(file, out.out);
    const page = withoutEngine(readFileSync(file, "utf8"));
    const errorsList = page.match(/<section class="errors" id="errors"[\s\S]*?<\/section>/)?.[0];
    assert.match(
      errorsList ?? "",
      /<li><code>ontology-adr-missing<\/code> <code>docs\/adr\/checkout\/0001-a\.md<\/code>/,
    );
    const flow = sections(page).find((s) => decodeAnchor(s.id) === "ordering.place-order");
    for (const id of MAPPING.categories.checkout.realizes) {
      assert.match(articleOf(page, id), UNKNOWN, id);
      const listed = flow.body.match(new RegExp(`<li><a href="#${anchorOf(id)}">.*?</li>`))?.[0];
      assert.match(listed ?? "", UNKNOWN, `${id} in the flow's steps`);
    }
    assert.match(
      articleOf(page, "ordering.confirm-order"),
      /<p class="state-notImplemented">not implemented<\/p>/,
      "a step of a feature whose ADR files agree with the index keeps its state",
    );
  });
});

test("the CLI view shows the steps of a feature whose ADR record names no file as undeterminable, as the gate refuses it", () => {
  withTmp((dir) => {
    initRepo(dir);
    const mapping = structuredClone(MAPPING);
    mapping.categories.checkout.adrs = [{ status: "Accepted (2020-01-01)", summary: "s" }];
    write(dir, "docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
    write(dir, "docs/ontology/model.ttl", EXAMPLE);
    writeAdrFiles(dir, mapping);
    commitAll(dir);
    const out = cli(dir, ["view", "--no-open"]);
    const file = /NOT_OPENED (\S+) — opening was not requested/.exec(out.out)?.[1];
    assert.ok(file, out.out);
    const page = withoutEngine(readFileSync(file, "utf8"));
    for (const id of mapping.categories.checkout.realizes)
      assert.match(articleOf(page, id), UNKNOWN, id);
    assert.doesNotMatch(articleOf(page, "ordering.submit-order"), />implemented</);
    const validated = cli(dir, ["validate"]);
    assert.equal(validated.code, 1, validated.out);
    assert.match(validated.out, /ontology-adr-record-invalid/);
  });
});
