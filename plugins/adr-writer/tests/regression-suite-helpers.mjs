// Fixtures that regression-suite.test.mjs and regression-suite.integration.test.mjs share.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Removed when the file finishes, so repeated runs do not fill the temporary directory.
export const tempDirs = [];

export const temp = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "adr-regression-test-"));
  tempDirs.push(dir);
  return dir;
};

export const sources = {
  "after:policy.md": "The actual learner-turn limit is five. This is not six.",
};

export function judgment(verdict = "PASS") {
  return {
    obligations: [
      {
        id: "contract",
        verdict,
        reason: "실제 문서의 다섯 턴 계약이 확인된다.",
        evidence: [{ source: "after:policy.md", quote: "actual learner-turn limit is five" }],
      },
    ],
  };
}
