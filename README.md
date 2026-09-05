# task-packet-store

Read and write task packets from a local file system or a Google Shared Drive. One CLI for tools
that consume or produce packet content, on a laptop or in CI.

For the complete Jira → stored packet → walkthrough → stored report flow, start with the
[operator playbook](docs/playbook.md). It lists the commands in order, their inputs and outputs,
and how to find the saved files.

## Requirements

- Node.js 20 or newer.
- rclone 1.75.0 for the `gdrive` driver. The `fs` driver needs no rclone.

## Install

For a repository or CI job, install an exact version as a development dependency and commit both
the manifest and the lockfile:

```sh
pnpm add --save-dev --save-exact @doruksahin/task-packet-store@X.Y.Z
pnpm exec task-packet-store --help
```

Replace `X.Y.Z` with a version that exists on npm. Do not use `latest`, `^`, or `~` in unattended
jobs. The committed lockfile fixes the resolved dependency graph. The exact direct dependency makes
upgrades explicit in code review.

For a one-off, non-locked invocation, npm can download and run one exact version without a global
installation:

```sh
npm exec --yes \
  --package=@doruksahin/task-packet-store@X.Y.Z \
  -- task-packet-store --help
```

## Commands

| Command | Summary |
| --- | --- |
| `fetch` | Download one frozen packet without runs into `<destination>/<TICKET>`. |
| `push` | Upload one packet from a local directory, without runs. |
| `begin` | Reserve the next `runs/vN` for a stage and write `run.md`. |
| `checkpoint` | Upload a source directory into the reserved run and write `snapshot.json`. |
| `pull` | Download every `stages/*/runs/**` into a local packet. |
| `locate` | Resolve an existing packet, run folder, or file to a local absolute path or Drive link. |
| `doctor` | Report the rclone version, the credential variables, and the resolved remote. |

All seven commands work through the same packet operations with either driver. The `fs` driver uses
the local filesystem directly; the `gdrive` driver spawns the pinned rclone binary.

Every command prints one JSON object on stdout when it succeeds. On failure stdout is empty and
stderr has one line `CODE: message`. Exit 0 on success, 2 for usage or configuration errors, and 1
for everything else. `task-packet-store --help` prints the full command reference.

## Library imports

For packet digest checks in standalone bundles, import the dependency-light identity entrypoint:

```js
import { packetSha256, DEFAULT_IDENTITY } from '@doruksahin/task-packet-store/identity';

const digest = packetSha256('/absolute/path/to/packet', DEFAULT_IDENTITY);
```

This entrypoint uses Node.js builtins and the package's identity/error helpers. It does not load
the CLI, transports, configuration schemas, YAML, or Zod. The package root exports remain available.
`matchesIdentity` and `regularFiles` are also available from the identity entrypoint for consumers
that need the same file selection and manifest walking.

## Configuration

One JSON file, credential-free, committable. Unknown keys are rejected.

Google Shared Drive:

```json
{
  "driver": "gdrive",
  "sharedDriveId": "0ABcDeFgHiJkLmNoPqR",
  "prefix": "packets",
  "identity": ["00 Packet.md", "task.md", "jira/**"]
}
```

Local file system:

```json
{
  "driver": "fs",
  "root": "/absolute/path/to/packets",
  "identity": ["00 Packet.md", "task.md", "jira/**"]
}
```

- `identity` defaults to the three entries shown. An entry is an exact file or `dir/**`.
- `prefix` is optional, with no leading or trailing slash.

Credentials for the `gdrive` driver come from the process environment only. Set exactly one of:

| Variable | Use |
| --- | --- |
| `PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS` | CI. The service account key JSON, inline. |
| `PACKET_STORE_DRIVE_TOKEN` | Laptop. The output of `rclone authorize "drive"`. |

The `fs` driver needs neither. Do not put these values in the configuration file, command
arguments, or source control.

## Documentation

- [Operator playbook](docs/playbook.md): commands, inputs, and outputs for Drive or filesystem storage.
- [Integrate another workflow](docs/integrating-a-workflow.md): reuse store selection around ordinary input/output files.
- [Design](docs/design/README.md): the 30-second overview, the architecture, and the CLI contract.
- [Plan](docs/plan/README.md): completed delivery, acceptance evidence, and optional follow-ups.
