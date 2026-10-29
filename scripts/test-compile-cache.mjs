// Reuse compiled modules across test workers and their CLI subprocesses. Node
// invalidates entries when source or runtime changes; no test results are cached.
// Respect NODE_COMPILE_CACHE and NODE_DISABLE_COMPILE_CACHE, and keep running
// uncached when temporary storage is unavailable.
import { enableCompileCache } from "node:module";
import { resolve } from "node:path";

const { directory } = enableCompileCache();
if (directory)
  process.env.NODE_COMPILE_CACHE = resolve(process.env.NODE_COMPILE_CACHE || directory);
