/** Validate response-only tool scope and required tail fields, leaving prose meaning to GEval. */
export function responseChecks({ tail, events }, fields, { noTools = true } = {}) {
  if (!Array.isArray(events)) throw new Error("Response checks require captured tool events");
  const requests = events.filter((event) => event.kind === "request");
  const forbidden = noTools
    ? requests
    : requests.filter(
        (event) =>
          ["write_file", "delete_file", "move_file", "demote_adr_status"].includes(event.tool) ||
          (event.tool === "run_check" && event.arguments?.kind === "status"),
      );
  return [
    {
      label: noTools ? "response task invokes no tools" : "response task performs no mutations",
      pass: forbidden.length === 0,
      detail: `${forbidden.length} forbidden requests`,
    },
    ...Object.entries(fields).map(([tag, keys]) => {
      const found = tail.findings.filter((finding) => finding.tag === tag);
      return {
        label: `required ${tag} fields`,
        pass:
          found.length === 1 &&
          keys.every((key) =>
            new RegExp(`(?:^|;)\\s*${key}\\s*=\\s*[^;\\s]`).test(found[0].summary),
          ),
        detail: found[0]?.summary ?? "missing tail item",
      };
    }),
  ];
}
