import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { searchAdrs, renderAdrSearch } from "../scripts/adr-search.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "decision-search-"));
  const mapping = { categories: {} };
  const write = (rel, body) => {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, body);
    return file;
  };
  const add = (category, name, title, body, status = "Proposed") => {
    const rel = "docs/adr/" + category + "/" + name;
    mapping.categories[category] ??= { adrs: [], dependsOn: [] };
    mapping.categories[category].adrs.push({
      path: rel,
      status,
      summary: "Decision about " + title,
    });
    write(rel, "# " + title + "\n\n## Status\n\n" + status + "\n\n## Decision\n\n" + body + "\n");
    return rel;
  };
  const save = () => write("docs/adr/.mapping.json", JSON.stringify(mapping, null, 2));
  const search = (query, extra = {}) => searchAdrs({ root, query, ...extra });
  return {
    root,
    mapping,
    write,
    add,
    save,
    search,
    close: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("search reads indexed body sections and preserves the selected category and original ranges", async () => {
  const f = fixture();
  try {
    const rel = f.add(
      "orders",
      "0001-parcel.md",
      "Parcel handling",
      "Quarantine the parcel marker.",
    );
    f.add("billing", "0001-charge.md", "Billing", "Quarantine the charge record.");
    f.save();
    const r = await f.search("parcel quarantine", { category: "orders" });
    assert.equal(r.complete, true);
    assert.equal(r.navigationOnly, true);
    assert.equal(r.page.total, 1);
    assert.equal(r.results[0].path, rel);
    assert.equal(r.results[0].section, "Decision");
    assert.equal(r.results[0].source.lineStart, 7);
    assert.ok(
      r.results[0].matches.some((m) => m.field === "body" && m.terms.includes("quarantine")),
    );
    assert.equal((await f.search('"quarantine parcel"')).page.total, 0);
    assert.match(renderAdrSearch(r), /not approval/);
  } finally {
    f.close();
  }
});

test("title-only hits point at document metadata instead of an unrelated short Status section", async () => {
  const f = fixture();
  try {
    f.add("orders", "0001-recovery.md", "Parcel recovery", "The operator inspects pending work.");
    f.save();
    const r = await f.search("parcel recovery");
    assert.equal(r.results[0].relevance.kind, "title");
    assert.equal(r.results[0].section, "Document metadata");
    assert.equal(r.results[0].source.lineStart, 1);
    assert.equal(r.results[0].matchingSections, 0);
    assert.ok(r.results[0].matches.some((m) => m.field === "title" && m.source.lineStart === 1));
  } finally {
    f.close();
  }
});

test("many matching sections count as one document and all pages retain unique candidates", async () => {
  const f = fixture();
  try {
    for (let i = 1; i <= 5; i++)
      f.add(
        "orders",
        "000" + i + "-work.md",
        "Work " + i,
        "needle\n\n### Details\n\nneedle\n\n### Exceptions\n\nneedle",
      );
    f.save();
    const paths = [],
      initial = await f.search("needle", { limit: 2 });
    let r = initial;
    for (;;) {
      paths.push(...r.results.map((row) => row.path));
      if (!r.next) break;
      r = await f.search("needle", r.next);
    }
    assert.equal(initial.page.total, 5);
    assert.equal(paths.length, 5);
    assert.equal(new Set(paths).size, 5);
    assert.equal(initial.results[0].matchingSections, 3);
  } finally {
    f.close();
  }
});

test("body and index changes invalidate search results without promoting or editing a decision", async () => {
  const f = fixture();
  try {
    const old = f.add("orders", "0001-payment.md", "Payment", "결제가 완료되면 주문을 확정한다.");
    f.save();
    assert.equal((await f.search("확정 결제")).results[0].path, old);
    const newer = "docs/adr/orders/0002-payment.md";
    f.write(
      newer,
      "# Payment\n\n## Status\n\nAccepted (2026-11-07)\n\n## Decision\n\n환불을 확인한다.\n",
    );
    f.mapping.categories.orders.adrs = [{ path: newer, status: "Proposed", summary: "Payment" }];
    f.save();
    rmSync(path.join(f.root, old));
    const before = readFileSync(path.join(f.root, newer));
    const r = await f.search("환불");
    assert.equal(r.complete, false);
    assert.ok(r.diagnostics.some((d) => d.code === "status-mismatch"));
    assert.equal(r.results[0].path, newer);
    assert.equal(r.results[0].status, "Accepted (2026-11-07)");
    assert.equal(r.results[0].indexedStatus, "Proposed");
    assert.equal(r.results[0].trusted, false);
    assert.equal((await f.search("결제")).page.total, 0);
    assert.deepEqual(readFileSync(path.join(f.root, newer)), before);
  } finally {
    f.close();
  }
});

test("unreadable or unsafe source state is reported rather than silently treated as empty", async () => {
  const f = fixture();
  try {
    const rel = f.add("orders", "0001-work.md", "Work", "needle");
    f.save();
    rmSync(path.join(f.root, rel));
    let r = await f.search("needle");
    assert.equal(r.complete, false);
    assert.equal(r.diagnostics[0].where, rel);
    f.write("docs/adr/.mapping.json", "{broken");
    r = await f.search("needle");
    assert.equal(r.found, null);
    assert.equal(r.complete, false);
    assert.equal(r.diagnostics[0].code, "index-unreadable");
    f.mapping.categories.orders.adrs[0].path = "../outside.md";
    f.save();
    r = await f.search("needle");
    assert.equal(r.complete, false);
    assert.ok(r.diagnostics.some((d) => d.code === "index-adrs-item-path-unsafe"));
  } finally {
    f.close();
  }
});

test("a linked document cannot make decision search read outside its document root", async () => {
  const f = fixture();
  try {
    const rel = f.add("orders", "0001-link.md", "Linked work", "ordinary");
    const external = f.write("external.txt", "secret needle");
    rmSync(path.join(f.root, rel));
    symlinkSync(external, path.join(f.root, rel));
    f.save();
    const r = await f.search("secret");
    assert.equal(r.complete, false);
    assert.equal(r.page.total, 0);
    assert.match(r.diagnostics[0].message, /outside the selected/);
    assert.equal(readFileSync(external, "utf8"), "secret needle");
  } finally {
    f.close();
  }
});

test("invalid query syntax and page input fail before changing sources", async () => {
  const f = fixture();
  try {
    f.add("orders", "0001-work.md", "Work", "needle");
    f.save();
    const before = readFileSync(path.join(f.root, "docs/adr/.mapping.json"));
    assert.throws(() => f.search('"unclosed'), /unclosed/);
    assert.throws(() => f.search("needle", { limit: 0 }), /limit/);
    assert.deepEqual(readFileSync(path.join(f.root, "docs/adr/.mapping.json")), before);
  } finally {
    f.close();
  }
});
