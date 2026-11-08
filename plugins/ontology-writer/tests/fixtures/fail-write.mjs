// Test preload: writing the file named by ADR_TEST_FAIL_WRITE fails, as a full
// disk or a revoked permission would, so restore paths can be exercised.
// Bun does not carry a mutated CommonJS fs object into named ESM exports, so the
// preload replaces the module itself.
import fs from "node:fs";
import path from "node:path";
import { mock } from "bun:test";

const target = process.env.ADR_TEST_FAIL_WRITE;
const original = fs.writeFileSync;
const failWrite = (file, ...rest) => {
  if (target && path.resolve(String(file)) === path.resolve(target))
    throw Object.assign(new Error(`EIO: i/o error, write '${file}'`), { code: "EIO" });
  return original(file, ...rest);
};
mock.module("node:fs", () => ({
  ...fs,
  default: { ...fs, writeFileSync: failWrite },
  writeFileSync: failWrite,
}));
