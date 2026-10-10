#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const upstream = path.dirname(require.resolve("mermaid/package.json"));
const target = path.join(root, "shared/report-writer/scripts/vendor");
const check = process.argv.includes("--check");
if (process.argv.slice(2).some((arg) => arg !== "--check"))
  throw new Error("Usage: vendor-report-mermaid.mjs [--check]");
const bundle = await build({
  entryPoints: [path.join(root, "scripts/mermaid-parser-entry.mjs")],
  absWorkingDir: root,
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  banner: {
    js: 'import { createRequire as bundleRequire } from "node:module"; const require = bundleRequire(import.meta.url);',
  },
  target: "node24",
  minify: true,
  legalComments: "inline",
  metafile: true,
});
const packages = new Map();
for (const input of Object.keys(bundle.metafile.inputs)) {
  if (!input.includes("node_modules/")) continue;
  let dir = path.dirname(path.resolve(root, input));
  while (dir !== path.dirname(dir)) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
      if (pkg.name && pkg.version) {
        packages.set(pkg.name, { dir, pkg });
        break;
      }
    } catch {
      /* Walk up from a bundled module to its owning package. */
    }
    dir = path.dirname(dir);
  }
}
const licenses = [...packages.values()]
  .sort((a, b) => a.pkg.name.localeCompare(b.pkg.name))
  .map(({ dir, pkg }) => {
    let license;
    for (const name of [
      "LICENSE",
      "LICENSE.md",
      "LICENSE.txt",
      "license",
      "license.md",
      "license.txt",
    ]) {
      try {
        license = readFileSync(path.join(dir, name), "utf8");
        break;
      } catch {
        /* Try the package's other conventional license names. */
      }
    }
    if (!license) {
      try {
        license = readFileSync(path.join(dir, "README.md"), "utf8").match(
          /^## License\s*\n([\s\S]*)/im,
        )?.[1];
      } catch {
        /* Require an actual license, never infer its text. */
      }
    }
    if (!license) throw new Error(`Missing license text for ${pkg.name}`);
    return `${pkg.name} ${pkg.version}\n${license}`;
  });
const files = [
  ["mermaid.min.js", readFileSync(path.join(upstream, "dist/mermaid.min.js"))],
  ["mermaid-parser.mjs", bundle.outputFiles[0].contents],
  ["MERMAID-LICENSES.txt", Buffer.from(licenses.join("\n\n"))],
];
if (!check) mkdirSync(target, { recursive: true });
for (const [name, content] of files) {
  const destination = path.join(target, name);
  if (check) {
    if (!readFileSync(destination).equals(Buffer.from(content)))
      throw new Error(`Report Mermaid asset drift: ${name}; run pnpm report-assets:sync`);
  } else writeFileSync(destination, content);
}
console.log(`${check ? "Verified" : "Vendored"} Mermaid browser, parser and licenses.`);
