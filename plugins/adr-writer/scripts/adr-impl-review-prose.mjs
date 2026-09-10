/**
 * Compose the comparison body once for Markdown and HTML. Field values remain
 * complete sentences; add a transition only when the author did not supply one.
 * Escaping belongs to the output format, not this plain-text composition.
 */
export function relatedAdrComparisonProse(comparison, language) {
  const korean = language === "ko";
  const join = (text, prefix, existing) => {
    const value = String(text ?? "").trim();
    return existing.test(value) ? value : `${prefix}${value}`;
  };
  return [
    String(comparison.similarity ?? "").trim(),
    join(
      comparison.difference,
      korean ? "반면 " : "However, ",
      korean ? /^(?:반면|하지만|다만|그러나)/ : /^(?:however|but|in contrast|unlike)\b/i,
    ),
    join(
      comparison.reviewImpact,
      korean ? "따라서 " : "Therefore, ",
      korean ? /^(?:따라서|그러므로|그래서|이에 따라)/ : /^(?:therefore|so|thus|consequently)\b/i,
    ),
  ].join(" ");
}

/**
 * Compose one Hill's visible explanation without repeating identical field text.
 * Only identical whole fields (ignoring outer padding) are deduplicated within this Hill.
 * Contract rows, code evidence, other Hills, and the source object stay untouched.
 */
export function hillNarrativeParagraphs(hill) {
  const seen = new Set();
  const groups = [
    [[hill.sliceName, hill.claim], ". "],
    [[hill.workedExample], ""],
    [[hill.counterexample], ""],
    [[hill.container?.responsibility, hill.container?.interactions], " "],
    [[hill.container?.outcome, hill.assessment], " "],
  ];
  return groups
    .map(([values, separator]) =>
      values
        .flatMap((value) => {
          const text = String(value ?? "").trim();
          const key = text;
          if (!key || seen.has(key)) return [];
          seen.add(key);
          return [text];
        })
        .join(separator),
    )
    .filter(Boolean);
}
