// Fixtures that ontology-guidance.test.mjs and ontology-guidance.integration.test.mjs share.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ADR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const read = (rel) => readFileSync(path.join(ADR, rel), "utf8");

export { EXAMPLE } from "./ontology-helpers.mjs";
