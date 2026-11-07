// bun test runs its tests in UTC unless TZ is set, but the CLIs a test starts
// inherit only the environment. Name the zone the tests already use, so a date
// a test computes and a date its CLI records come from the same calendar.
process.env.TZ ??= "UTC";
