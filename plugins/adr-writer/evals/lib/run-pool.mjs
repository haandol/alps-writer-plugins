import { availableParallelism } from "node:os";

// Bound simultaneous provider calls on large hosts. An explicit --jobs always wins.
export const DEFAULT_JOBS = Math.min(4, availableParallelism());

/** Each repeat has a private workspace; the caller orders the turns and variants inside it. */
export function caseRepeats(cases, repeats) {
  return cases.flatMap((item) =>
    Array.from({ length: repeats }, (_, index) => ({ item, repeat: index + 1 })),
  );
}

export async function runPool(items, jobs, action) {
  let next = 0;
  const workers = Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await action(item);
    }
  });
  // If one worker fails, let the other owned workers finish before returning.
  const settled = await Promise.allSettled(workers);
  const failed = settled.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
}
