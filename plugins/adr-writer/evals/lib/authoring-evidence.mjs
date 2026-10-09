import { sha } from "../regression/workspace.mjs";

/** Check observed candidate validation, not a final file or a claimed PASS. */
export function authoringEvidenceChecks(events, { draftRoot, category }) {
  const requests = new Map();
  let prepared = false,
    validated,
    lastDraftChange = 0,
    lastOfficialWrite = 0;
  let writes = 0,
    verifiedWrites = true,
    finalCheck = false;
  const relevant = (args) => !args.category || args.category === category;
  for (const event of events ?? []) {
    if (event.kind === "request") {
      requests.set(event.seq, event);
      if (["write_file", "delete_file", "move_file", "demote_adr_status"].includes(event.tool)) {
        const paths = [event.arguments?.path, event.arguments?.from, event.arguments?.to].filter(
          Boolean,
        );
        let validTransfer = false;
        if (paths.some((p) => p.startsWith("docs/"))) {
          const { path: file, content, from, to } = event.arguments ?? {};
          writes++;
          lastOfficialWrite = event.seq;
          finalCheck = false;
          const fresh = prepared && validated && validated.seq > lastDraftChange;
          validTransfer = Boolean(
            fresh &&
            event.tool === "move_file" &&
            from === `${draftRoot}/${to}` &&
            validated.hashes[to],
          );
          verifiedWrites &&=
            validTransfer ||
            Boolean(
              fresh &&
              event.tool === "write_file" &&
              typeof content === "string" &&
              validated.hashes[file] === sha(content),
            );
        }
        // Moving a verified file into place consumes it without changing the
        // other validated contents. Other candidate edits require a new check.
        if (!validTransfer && paths.some((p) => p.startsWith(`${draftRoot}/`)))
          lastDraftChange = event.seq;
      }
      continue;
    }
    const request = requests.get(event.request);
    if (!request || event.kind !== "result") continue;
    if (request.tool === "prepare_draft" && event.ok && event.result?.root === draftRoot)
      prepared = true;
    if (
      request.tool !== "run_check" ||
      request.arguments?.kind !== "structure" ||
      !relevant(request.arguments)
    )
      continue;
    const passed = event.ok && event.result?.exitCode === 0;
    if (request.arguments.draft) {
      validated =
        passed && event.result.checkedRoot === draftRoot && event.result.documentHashes
          ? { seq: event.seq, hashes: event.result.documentHashes }
          : undefined;
    } else if (passed && lastOfficialWrite && request.seq > lastOfficialWrite) finalCheck = true;
  }
  return [
    { label: "independent candidate workspace prepared", pass: prepared },
    {
      label: "every official write matches a freshly validated candidate",
      pass: writes > 0 && verifiedWrites,
    },
    { label: "target validates official structure after its last write", pass: finalCheck },
  ];
}
