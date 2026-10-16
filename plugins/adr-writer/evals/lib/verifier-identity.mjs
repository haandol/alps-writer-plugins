import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles, sha } from "../regression/workspace.mjs";
const implementationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Hash the actual grading implementation plus the selected shared checkers/rules, independently of target guidance. */
export function verifierIdentity(
  checkerRoot = implementationRoot,
  gradingRoot = implementationRoot,
) {
  const sources = (root, directory) =>
    listFiles(root, directory)
      .filter((file) => !file.endsWith(".test.mjs"))
      .map((file) => [file, sha(readFileSync(path.join(root, file), "utf8"))]);
  return sha({
    node: process.version,
    grading: sources(gradingRoot, "evals"),
    checker: ["scripts", "templates"].flatMap((dir) => sources(checkerRoot, dir)),
  });
}
