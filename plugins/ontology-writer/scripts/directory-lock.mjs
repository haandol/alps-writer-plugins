import { mkdirSync, rmSync, statSync } from "node:fs";

const LOCK_WAIT_MS = 15_000;
const LOCK_STALE_MS = 10_000;

/** Run `fn` holding a directory lock; a lock left by a writer that died is stale after a while. */
export function withLock(lock, fn) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let age = 0;
      try {
        age = Date.now() - statSync(lock).mtimeMs;
      } catch {
        continue; // released between the two calls
      }
      if (age > LOCK_STALE_MS) rmSync(lock, { recursive: true, force: true });
      else if (Date.now() > deadline) throw new Error(`the answers file stays locked: ${lock}`);
      else Bun.sleepSync(5);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}
