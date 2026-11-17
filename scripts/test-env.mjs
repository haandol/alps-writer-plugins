// Environment for every process a test starts, set once here instead of at each call.
// - bun test runs in UTC unless TZ is set, but a CLI a test starts inherits only the
//   environment, so name that zone: a date a test computes and a date its CLI
//   records then come from the same calendar.
// - A fixture repository is copied right after its commits. Git 2.47+ detaches the
//   automatic maintenance a commit starts, which can create and remove
//   `.git/objects/maintenance.lock` while the copy reads the folder, so no git a test
//   starts runs automatic maintenance or garbage collection.
// - A shipped script must run with no package installed, so no Bun a test starts may
//   install one on the fly.
process.env.TZ ??= "UTC";
process.env.BUN_OPTIONS = [process.env.BUN_OPTIONS, "--no-install"].filter(Boolean).join(" ");
process.env.GIT_CONFIG_PARAMETERS = [
  process.env.GIT_CONFIG_PARAMETERS,
  "'maintenance.auto'='false'",
  "'gc.auto'='0'",
]
  .filter(Boolean)
  .join(" ");
