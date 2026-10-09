# Implementation prerequisite gate

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

2. **Dependency check (prerequisite ADR gate) — a mandatory step that cannot be skipped**

   Features depend on each other — for example, implementing "checkout (`checkout`)" is only meaningful once "cart (`cart`)" already works. If you ignore this dependency and start with the requested ADR, you stack code on top of a missing prerequisite and diverge from the real order of operation. So **look at dependencies before implementing or planning — this step cannot be omitted or deferred.** (The category keys in the examples below are name-based canonical keys, and the target is specified with such a key.)
   - Read `dependsOn` from the target category's entry in `docs/adr/.mapping.json` (this value was carried over from ALPS Section 6.3 Feature Dependency Diagram by `/feature-to-adr`, or recorded directly as a prerequisite by `/adr-new` at authoring time).
     - If the entry exists but **the `dependsOn` key itself is absent** — no dependency has been declared. Say in one line, "This ADR does not declare `dependsOn`, so I'm proceeding without a prerequisite check — if there are prerequisite ADRs, fill them in via `dependsOn` in `.mapping.json` or via `/feature-to-adr`", then proceed to step 3 (do not silently treat "no dependencies" and "dependencies undeclared" as the same thing).
     - If `dependsOn` is an **empty array (`[]`)**, that is an explicit, completed check that there are no dependencies, so proceed to step 3 without any notice.
   - If `dependsOn` has keys, walk the graph **one node at a time to visit the transitive prerequisite categories** (e.g. `checkout` → `cart` → `identity/login`). If any node you visit is a **dangling reference** (no `.mapping.json` entry, or not a single ADR file on disk), stop right there — transitive expansion requires reading that node's entry and `dependsOn` to move to the next hop, so if an intermediate node is dangling you cannot reach the deeper prerequisites (which is why you check at every hop rather than "after collecting everything"). If it is not dangling, read that node's `dependsOn` to expand into deeper prerequisites, and check the visited node's ADR Status.
   - **When you hit a dangling reference** — stop the implementation and repair the mapping before proceeding. Do not create a placeholder ADR merely to close the graph. A completed `/feature-to-adr` handoff gives every transferred Feature a real requirement-contract owner and records only prerequisites needed to satisfy those contracts; shared helpers, SDK reuse, and convenient work order do not become `dependsOn`.
   - **If every prerequisite ADR is `Accepted` (implementation complete)**, the dependencies are satisfied, so proceed to step 3 as-is.
   - **If even one prerequisite ADR is `Proposed` (not implemented), stop the downstream implementation.** Rebuild the target list in dependency topological order (deepest prerequisite first) and implement those prerequisites before returning to the requested target. User confirmation cannot turn an unimplemented prerequisite into a completed one.
   - **When there are multiple target ADRs (whether the user picked several directly or you added prerequisites above), always topologically sort them by the `dependsOn` graph and implement from the deepest prerequisite in order.** Do not simply follow the order the user typed (`checkout, identity/login, cart`) — dependency order takes precedence over input order. Show the sorted implementation order to the user in one line ("Implementation order: identity/login → cart → checkout") and proceed.
   - If the dependency graph has a cycle (e.g. `cart` ↔ `checkout`), topological sorting is impossible, so stop the implementation, report which categories are entangled, and require the dependency model to be corrected before implementation.

     ```
     `checkout` depends on `cart`, but `cart` is not implemented yet (Proposed).
     By dependency order, `cart` has to be implemented first for `checkout` to work properly.

     Implementation order: `cart` → `checkout`.
     The downstream ADR remains blocked until `cart` is `Accepted`.
     ```

   - If this is a legacy ADR set where `.mapping.json` itself is missing or the target category has no entry at all, the dependencies are unknowable, so skip the gate — but say in one line, "There is no dependency information, so I'm skipping the ordering check (you can fill it in via `/feature-to-adr` or `dependsOn` in `.mapping.json`)". (The case where the entry exists but only the `dependsOn` key is missing is handled by the "dependencies undeclared" branch above, not by this legacy case.)
