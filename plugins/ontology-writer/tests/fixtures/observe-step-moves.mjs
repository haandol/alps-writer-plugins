// Observe the published files after each individual model rename. The optional
// failure exercises rollback after an intermediate document has been installed.
import fs from "node:fs";
import path from "node:path";
import { mock } from "bun:test";
import { elementIri, indexGraph, parseTurtle, unionGraph } from "../../scripts/ontology-lib.mjs";

const modelDir = path.resolve("docs/ontology");
const nativeRename = fs.renameSync;
let renames = 0;
function observeRename(from, to) {
  if (path.dirname(path.resolve(to)) !== modelDir) return nativeRename(from, to);
  renames++;
  if (renames === Number(process.env.FAIL_MODEL_RENAME))
    throw Object.assign(new Error("model rename failed"), { code: "EIO" });
  nativeRename(from, to);
  const model = fs
    .readdirSync(modelDir)
    .filter((file) => file.endsWith(".ttl"))
    .map((file) => parseTurtle(fs.readFileSync(path.join(modelDir, file), "utf8")));
  const index = indexGraph(unionGraph(model));
  const { categories } = JSON.parse(fs.readFileSync("docs/adr/.mapping.json", "utf8"));
  const missing = Object.values(categories)
    .flatMap((entry) => entry.realizes ?? [])
    .filter((id) => index.typeOf(elementIri(id)) !== "Step");
  fs.appendFileSync("observations.jsonl", JSON.stringify(missing) + "\n");
}
mock.module("node:fs", () => ({
  ...fs,
  default: { ...fs, renameSync: observeRename },
  renameSync: observeRename,
}));
