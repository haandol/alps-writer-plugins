# Repository-local evidence boundary

Read this file completely when an ADR or its implementation scope involves
infrastructure, deployment, cloud resources, clusters, remote services, or IaC
(Infrastructure as Code), or when any proposed verification might authenticate
or contact a remote system.

## What adr-sync verifies

`/adr-sync` verifies the repository's implementation of an ADR. Infrastructure
implementation evidence includes:

- IaC source such as Terraform, CDK, CloudFormation, or Pulumi;
- deployment and policy manifests such as Kubernetes, Helm, IAM, network, and
  encryption policy definitions;
- repository-local configuration, generated templates, schemas, and committed
  plans or snapshots;
- unit, policy, validation, and snapshot tests;
- deterministic local output only when the command is known not to authenticate,
  read remote state, perform provider lookups, or contact a remote service.

Treat these artifacts as code evidence. For example, verify a required GSI,
multi-zone topology, encryption rule, retention policy, or role boundary from
IaC and its tests rather than querying the deployed resource.

## What adr-sync never does

Do not access live or remote infrastructure, including read-only access. Existing
credentials, an authenticated shell, or a read-only command do not expand the
scope.

Do not:

- call cloud provider APIs, CLIs, or consoles;
- query a Kubernetes cluster, remote database, queue, object store, secret
  manager, SaaS administration API, or deployment platform;
- log in, assume a role, discover credentials, inspect remote state, refresh
  provider state, or run a command that may perform a remote lookup;
- deploy, apply, mutate, restart, scale, reconcile, or otherwise change a remote
  environment.

Do not whitelist a command by product name alone. A plan, preview, synth, diff,
or validation command may still read a remote backend, resolve provider data, or
authenticate. Run it only when its current configuration and flags establish
that it is local-only; otherwise inspect source and tests and leave the
runtime-only axis unverified.

## Classification

Keep these judgments separate:

- **Repository aligned** — the ADR decision and contract are represented by the
  repository source, IaC, configuration, and tests.
- **Repository drift** — repository evidence contradicts or omits the ADR
  decision or contract.
- **Runtime state unverified** — the deployed environment could only be checked
  through remote access. This is not ADR drift and does not weaken an otherwise
  established repository-alignment result.

Never infer deployed state from IaC alone. Conversely, never use an observed
runtime difference to rewrite an ADR or classify code drift inside `/adr-sync`.
Live-state assurance belongs to a separate operational or deployment audit with
its own explicit authorization and safety rules.

## Status and reporting

ADR Status follows repository implementation, tests, and the required
implementation-review lifecycle. Deployment presence or current production
state is not a Status prerequisite, and an unverified runtime claim does not
demote an ADR.

In the report:

- list the repository evidence inspected;
- state `Live environment access: not performed — outside adr-sync scope`;
- record each runtime-only claim as `[Runtime state unverified]`;
- use `In Sync` only for ADR ↔ repository implementation alignment, never as a
  claim that a deployed environment was inspected.
