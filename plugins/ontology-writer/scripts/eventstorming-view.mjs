#!/usr/bin/env node
// Open a disposable candidate board before or after a model exists. Never writes
// the model or index; source text and evidence are inert presentation data.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { allocateRunDirectory } from "./ontology-fs.mjs";
import { openReviewReport } from "./adr-impl-review-open.mjs";
import { eventBoardPage, validateEventBoard } from "./eventstorming-board.mjs";
const [input, ...args] = process.argv.slice(2);
try {
  if (
    !input ||
    args.some(
      (a, i) =>
        !["--out", "--lang", "--browser", "--no-open"].includes(a) &&
        !["--out", "--lang", "--browser"].includes(args[i - 1]),
    )
  )
    throw new Error(
      "Usage: eventstorming-view.mjs <board.json> [--out file.html] [--lang en|ko] [--browser name] [--no-open]",
    );
  const value = (name) => {
    const i = args.indexOf(name);
    if (i < 0) return null;
    if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`${name} needs a value`);
    return args[i + 1];
  };
  const lang = value("--lang") ?? "en";
  if (!["en", "ko"].includes(lang)) throw new Error("lang must be en or ko");
  const selectedBrowser = value("--browser");
  const board = JSON.parse(readFileSync(input, "utf8"));
  const errors = validateEventBoard(board);
  if (errors.length) throw new Error(errors.join("\n"));
  if (board.origin !== "candidate") throw new Error("candidate input must use origin: candidate");
  const html = eventBoardPage(board, { lang });
  const output =
    value("--out") ??
    path.join(allocateRunDirectory(process.cwd(), "eventstorming").dir, "eventstorming.html");
  if (path.extname(output).toLowerCase() !== ".html")
    throw new Error("output must be an HTML file");
  writeFileSync(output, html, { flag: "wx" });
  if (args.includes("--no-open"))
    console.log(`NOT_OPENED ${path.resolve(output)} — opening was not requested`);
  else {
    const result = await openReviewReport(path.resolve(output), { browser: selectedBrowser });
    console.log(
      `${result.opened ? "OPENED" : "NOT_OPENED"} ${result.path}${result.reason ? " — " + result.reason : ""}`,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
