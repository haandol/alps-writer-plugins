#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const packagePath = require.resolve("diff2html/package.json");
const upstream = path.dirname(packagePath);
const upstreamRequire = createRequire(packagePath);
const target = path.join(root, "shared/report-writer/scripts/vendor");
if (process.argv.slice(2).some((arg) => arg !== "--check"))
  throw new Error("Usage: vendor-report-diff.mjs [--check]");
const check = process.argv.includes("--check");
const files = [
  ["diff2html.cjs", readFileSync(path.join(upstream, "bundles/js/diff2html.min.js"))],
  ["diff2html.css", readFileSync(path.join(upstream, "bundles/css/diff2html.min.css"))],
];
const licenses = [
  ["diff2html", upstream, "LICENSE.md"],
  ["diff", path.dirname(upstreamRequire.resolve("diff/package.json")), "LICENSE"],
  [
    "@profoundlogic/hogan",
    path.dirname(upstreamRequire.resolve("@profoundlogic/hogan/package.json")),
    "LICENSE",
  ],
].map(([name, directory, license]) => {
  const { version } = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
  return `${name} ${version}\n${readFileSync(path.join(directory, license), "utf8")}`;
});
files.push(["LICENSES.txt", Buffer.from(licenses.join("\n\n"))]);
if (!check) mkdirSync(target, { recursive: true });
for (const [name, content] of files) {
  const destination = path.join(target, name);
  if (check) {
    if (!readFileSync(destination).equals(content))
      throw new Error(`Report diff asset drift: ${name}; run pnpm report-assets:sync`);
  } else writeFileSync(destination, content);
}
console.log(`${check ? "Verified" : "Vendored"} diff2html report assets and bundled licenses.`);
