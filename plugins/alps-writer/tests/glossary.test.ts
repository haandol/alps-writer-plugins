import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DocumentService } from "../src/tools/documents/service.js";
import { parseGlossary } from "../src/tools/documents/glossary.js";

for (const profile of ["alps", "lite"] as const) {
  test(`${profile}: ordinary documents omit the glossary without changing section completion`, (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-glossary-"));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const target = path.join(dir, profile === "lite" ? "test.lite.alps.xml" : "test.alps.xml");
    const service = new DocumentService();
    service.initDocument("Plain language", target, profile);
    const before = fs.readFileSync(target, "utf8");
    assert.doesNotMatch(before, /glossary/);
    assert.match(service.readGlossary(), /No glossary/);
    assert.doesNotMatch(service.exportMarkdown(), /Appendix/);
    assert.doesNotMatch(service.getStatus(), /Appendix/);
    assert.equal(fs.readFileSync(target, "utf8"), before);
    assert.equal((before.match(/<section /g) ?? []).length, profile === "lite" ? 4 : 9);
  });

  test(`${profile}: definitions survive section saves and fresh-service resume and export last`, (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-glossary-"));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const target = path.join(dir, profile === "lite" ? "test.lite.alps.xml" : "test.alps.xml");
    const service = new DocumentService();
    service.initDocument("Terms", target, profile);
    const initialStatus = service.getStatus();
    assert.match(service.saveGlossaryEntry("PO", "발송된 구매 주문. 초안은 제외."), /Saved/);
    assert.equal(service.getStatus().split("\nAppendix")[0], initialStatus);
    const sectionTitle = profile === "lite" ? "Target User and Core Problem" : "Purpose";
    assert.match(service.saveSection(1, "1", sectionTitle, "사용자의 PO 조회"), /Saved/);
    const raw = fs.readFileSync(target, "utf8");
    assert.ok(raw.indexOf("<glossary>") > raw.lastIndexOf("</section>"));

    const resumed = new DocumentService();
    assert.match(resumed.loadDocument(target), /Appendix \(Glossary\): 1/);
    assert.match(resumed.readGlossary(), /PO.*발송된 구매 주문/);
    assert.match(resumed.readSection(1, "1"), /사용자의 PO 조회/);
    const markdown = resumed.exportMarkdown();
    assert.equal((markdown.match(/## Appendix: Glossary/g) ?? []).length, 1);
    assert.ok(markdown.indexOf("## Appendix: Glossary") > markdown.lastIndexOf("## Section"));
    const output = path.join(dir, "export.md");
    resumed.exportMarkdown(output);
    assert.equal(fs.readFileSync(output, "utf8"), markdown);
  });
}

test("term updates preserve other entries and sections; equivalent repeated saves do not write", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-glossary-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "test.alps.xml");
  const service = new DocumentService();
  service.initDocument("Terms", target);
  service.saveSection(1, "1", "Purpose", "Original body");
  service.saveGlossaryEntry("PO", "초안 포함");
  service.saveGlossaryEntry("검수", "담당자가 제출 자료를 확인");
  service.saveGlossaryEntry(" PO ", "발송된 주문만");
  const before = fs.readFileSync(target, "utf8");
  assert.deepEqual(parseGlossary(before), [
    { term: "PO", definition: "발송된 주문만" },
    { term: "검수", definition: "담당자가 제출 자료를 확인" },
  ]);
  assert.match(service.readSection(1, "1"), /Original body/);
  const past = new Date("2020-01-01T00:00:00Z");
  fs.utimesSync(target, past, past);
  assert.match(service.saveGlossaryEntry("PO", "발송된 주문만"), /unchanged/);
  assert.equal(fs.statSync(target).mtimeMs, past.getTime());
  assert.equal(fs.readFileSync(target, "utf8"), before);
});

test("XML-sensitive terms, definitions and replacement tokens round-trip literally", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-glossary-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "test.alps.xml");
  const service = new DocumentService();
  service.initDocument("Terms", target);
  const term = 'A&B "<value>"';
  const definition = "literal </glossary> &amp; $& $` $'\nnext | cell";
  service.saveGlossaryEntry(term, definition);
  service.saveGlossaryEntry("PO", "another term");
  assert.deepEqual(parseGlossary(fs.readFileSync(target, "utf8"))[0], { term, definition });
  assert.match(service.exportMarkdown(), /<br>next \\\| cell/);
  assert.match(new DocumentService().loadDocument(target), /Appendix \(Glossary\): 2/);
});

test("case-distinct acronyms retain their separate confirmed meanings", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-glossary-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "test.alps.xml");
  const service = new DocumentService();
  service.initDocument("Terms", target);
  service.saveGlossaryEntry("eID", "전자 신원");
  service.saveGlossaryEntry("EID", "이벤트 식별자");
  assert.deepEqual(parseGlossary(fs.readFileSync(target, "utf8")), [
    { term: "eID", definition: "전자 신원" },
    { term: "EID", definition: "이벤트 식별자" },
  ]);
});

test("blank term updates and reads without a selected document never write", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-glossary-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "test.alps.xml");
  const service = new DocumentService();
  assert.match(service.readGlossary(), /No document loaded/);
  assert.match(service.saveGlossaryEntry("PO", "meaning"), /No document loaded/);
  service.initDocument("Terms", target);
  const before = fs.readFileSync(target, "utf8");
  assert.match(service.saveGlossaryEntry(" ", "meaning"), /non-empty/);
  assert.match(service.saveGlossaryEntry("PO", "\n"), /non-empty/);
  assert.equal(fs.readFileSync(target, "utf8"), before);
});

test("switching between Full and Lite never leaks term definitions", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-glossary-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const service = new DocumentService();
  const full = path.join(dir, "full.alps.xml");
  service.initDocument("Full", full);
  service.saveGlossaryEntry("PO", "Full meaning");
  service.initDocument("Lite", path.join(dir, "lite.lite.alps.xml"), "lite");
  assert.match(service.readGlossary(), /No glossary/);
  service.saveGlossaryEntry("PO", "Lite meaning");
  service.loadDocument(full);
  assert.match(service.readGlossary(), /Full meaning/);
  assert.doesNotMatch(service.readGlossary(), /Lite meaning/);
});

test("malformed, duplicate or misplaced glossary data is rejected without data loss", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alps-glossary-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const target = path.join(dir, "test.alps.xml");
  const service = new DocumentService();
  service.initDocument("Terms", target);
  const base = fs.readFileSync(target, "utf8");
  const valid = '<glossary><entry term="PO">meaning</entry></glossary>';
  const invalid = [
    "<glossary></glossary>",
    '<glossary><entry term="PO"> </entry></glossary>',
    '<glossary><entry term="">meaning</entry></glossary>',
    '<glossary><entry term="PO">meaning</entry><entry term=" PO ">other</entry></glossary>',
    '<glossary><entry term="PO">meaning</glossary>',
    "<glossary>loose content</glossary>",
    valid + valid,
    "<glossary>" + valid,
    valid + "</glossary>",
    valid + '<section id="1" title="Overview"></section>',
  ];
  for (const glossary of invalid) {
    const broken = base.replace("</alps-document>", glossary + "</alps-document>");
    fs.writeFileSync(target, broken);
    assert.match(service.loadDocument(target), /Invalid ALPS document/, glossary);
    assert.match(service.saveGlossaryEntry("safe", "meaning"), /No document loaded/);
    assert.equal(fs.readFileSync(target, "utf8"), broken);
  }
});
