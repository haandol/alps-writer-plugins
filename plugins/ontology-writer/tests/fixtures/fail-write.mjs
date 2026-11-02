// Test preload: writing the file named by ADR_TEST_FAIL_WRITE fails, as a full
// disk or a revoked permission would, so restore paths can be exercised.
import fs from "node:fs";
import path from "node:path";
import { syncBuiltinESMExports } from "node:module";

const target = process.env.ADR_TEST_FAIL_WRITE;
const original = fs.writeFileSync;
fs.writeFileSync = (file, ...rest) => {
  if (target && path.resolve(String(file)) === path.resolve(target))
    throw Object.assign(new Error(`EIO: i/o error, write '${file}'`), { code: "EIO" });
  return original(file, ...rest);
};
syncBuiltinESMExports();
