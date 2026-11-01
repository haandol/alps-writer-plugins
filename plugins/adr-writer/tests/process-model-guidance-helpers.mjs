// Fixtures that process-model-guidance.test.mjs and process-model-guidance.integration.test.mjs share.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ADR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const read = (rel) => readFileSync(path.join(ADR, rel), "utf8");

export const EXAMPLE = read("templates/process/example.ttl");
