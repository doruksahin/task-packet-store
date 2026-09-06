# task-packet-store architecture

## Responsibility

Store and retrieve task packets and stage outputs through one transport-independent interface.
The caller owns task acquisition, packet preparation, LLM execution, and human acceptance.
This package owns transport, packet identity, filtering, run reservation, checkpoints, and locations.

## Interfaces

The [CLI](../../src/cli.ts) accepts an explicit store configuration and ticket. `push` saves a
prepared packet; `fetch` materializes one; `begin` reserves a run; `checkpoint` saves its files;
`pull` retrieves runs; `locate` resolves locations; `doctor` reports setup.
The [CLI contract](../design/03-architecture.md) owns exact flags and output schemas.

The [library entry point](../../src/index.ts) exports operations; the
[identity module](../../src/identity.ts) supplies shared packet identity. A saved result is not
an AC verdict or a human approval.

## Dependencies

Installation: [package.json](../../package.json) has no internal plugin/package dependency.
Library calls: [operations](../../src/operations.ts) use [PacketTransport](../../src/transport.ts).
CLI calls: [Drive transport](../../src/rclone.ts) invokes rclone, which owns Drive API communication.
File exchange: [filesystem transport](../../src/fs-file.ts) accesses the configured directory.
This package does not connect to Jira. Tests exercise shared operations through both transports.

## Execution and storage

Runs on a developer host or CI runner with Node.js. `fs` selects a durable directory reachable
by that host; `gdrive` selects a Shared Drive and requires rclone and explicit credentials.
A temporary CI workspace is a processing copy, not durable filesystem storage. Reuse the same
configuration through the [consumer adapter contract](../design/06-workflow-adapters.md).

## Failure behavior

Missing input, invalid configuration, identity conflicts, or failed transport operations fail the
command. The package does not synthesize missing packets or silently choose another store.
The [CLI contract](../design/03-architecture.md) owns JSON receipts, error codes, and exit semantics.
Credentials are never part of receipts or logs.

## Current implementation

The [design index](../design/README.md) links the implemented contracts. The
[operator playbook](../playbook.md) covers Jira → packet → walkthrough → saved report.
The [integration guide](../integrating-a-workflow.md) describes another workflow's adapter.
Cross-repository relationships and source snapshots live in
[plugin-architecture](https://github.com/doruksahin/plugin-architecture).

## Planned changes

The ecosystem plans to extract the Jira packet producer from AC's repository. That is upstream
ownership work; this package's storage configuration, packet format, and identity remain the
shared interface. This rollout does not perform the extraction or change the published version.

## Decisions

[Storage decisions D1–D12](../design/00-decisions.md) own the delivered architecture.
The [shared standard](https://github.com/doruksahin/plugin-architecture/blob/main/standard/README.md)
governs this architecture entry page. Historical D11 describes delivered producer ownership;
the target extraction stays separately labelled until implemented.

## Verification

Run `python3 .architecture/check.py` for the contract, source links, internal installation
dependencies, and targeted source guards. Run `pnpm check` for required package behavior/type
checks; `pnpm release:check` remains the release candidate gate. The
[shared audit](https://github.com/doruksahin/plugin-architecture/blob/main/README.md) verifies
checker equality. These checks do not imply a fresh live Drive run or an AC pass.
