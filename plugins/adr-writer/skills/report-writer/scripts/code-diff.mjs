import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const diff2html = require("./vendor/diff2html.cjs");
export const diffCss =
  `/*\n${readFileSync(new URL("./vendor/LICENSES.txt", import.meta.url), "utf8").replace(/\*\//g, "* /")}\n*/\n` +
  readFileSync(new URL("./vendor/diff2html.css", import.meta.url), "utf8");

/** Parse actual unified patches with the bundled library, never infer a before version. */
export function parseCodeDiff(source) {
  if (typeof source !== "string" || !source.trim())
    throw new Error("Diff evidence requires a nonempty unified patch in excerpt");
  const files = diff2html.parse(source);
  if (!files.length || !files.some((file) => file.blocks.some((block) => block.lines.length)))
    throw new Error(
      "Diff evidence requires unified patch hunks; use an excerpt for non-text changes",
    );
  return files;
}

/** Produce static markup so printing and offline reading never wait for browser scripts. */
export function renderCodeDiff(source, id) {
  const html = diff2html.html(parseCodeDiff(source), {
    drawFileList: false,
    outputFormat: "line-by-line",
    matching: "none",
    colorScheme: "light",
    renderNothingWhenEmpty: false,
  });
  // The library hashes paths, so two selected hunks from one file need local IDs.
  const prefix = String(id).replace(/[^a-zA-Z0-9_-]/g, "-");
  return html.replace(/id="(d2h-\d+)"/g, (_, name) => `id="${prefix}-${name}"`);
}
