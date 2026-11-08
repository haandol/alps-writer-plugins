// DeepEval declares this exporter; nothing this repository runs loads it. Failing
// loudly keeps an unexpected use from silently exporting nothing.
throw new Error(
  "@opentelemetry/exporter-trace-otlp-proto is stubbed in this repository: DeepEval telemetry export is not used here",
);
