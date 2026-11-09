# Verification execution boundary

Read this file completely before running a test, evaluation, reproduction or
real entry point to produce implementation, review or alignment evidence. It
keeps verification inside the repository's local and test environments; an
approved contract, a required evaluation, a passing result or an authenticated
shell never grants access to a live system.

## Where verification runs

- Run verification against local processes, loopback servers, local emulators
  or containers, and the fixtures and test environments the repository declares
  for verification. A real entry point is the product's own entry point started
  in such an environment, not the deployed service.
- Before running a command, establish from its configuration and flags that it
  stays there: endpoints point at loopback or a declared test environment,
  credentials are test or fake values, and nothing falls back to a default
  credential chain, a shared profile or a remote backend. When that cannot be
  established, do not run it; inspect the source and tests instead.
- Do not reach a production or shared live environment, even read-only: no
  cloud or SaaS API, CLI or console call, no remote database, queue, object
  store, cluster or secret manager query, and no deploy, migration, backfill,
  message, payment or other change there. Existing credentials, an
  authenticated session or a read-only command do not widen this scope.
- A paid or remote evaluation provider runs only when the user authorized it for
  this work; otherwise record the evaluation as not run.

## Secrets

Never print, log or copy into evidence an environment variable listing,
credential, token, key, signed URL or connection string. Do not run commands
that dump the environment or echo secrets in debug output; refer to a needed
value by its name and redact it from artifacts.

## When only a live environment can show it

Deployed or production state is not itself an implementation obligation:
local evidence that runs the real entry points establishes it. When an
obligation, criterion or reproduction can still only be shown against a live
environment, do not run it. Record it as unverified with the environment and
authorization it needs, continue the independent work, and report it. Live
verification runs only after the user explicitly authorizes the named
environment and actions, and that authorization covers only those actions.

A blocked or failed live attempt is reported as it happened; never work around
it with other credentials, profiles or endpoints. Unverified is not a violation,
and it is not a pass: the owning workflow decides what an unverified required
item blocks.
