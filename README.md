# task-packet-store

Read and write task packets from a local file system, a Google Shared Drive, or a git repository.
One CLI for tools that consume or produce packet content, on a laptop or in CI.

For responsibilities, dependencies, execution/storage choices, and their source evidence, read
[the architecture contract](docs/architecture/README.md).

For the complete Jira → stored packet → walkthrough → stored report flow, start with the
[operator playbook](docs/playbook.md). It lists the commands in order, their inputs and outputs,
and how to find the saved files.

## Requirements

- Node.js 20 or newer.
- rclone 1.75.0 for the `gdrive` driver. The `fs` driver needs no rclone.
- git 2.28 or newer on `PATH` for the `git` driver; if the remote tracks files with Git LFS, `git-lfs`
  must also be installed — the driver does not manage LFS.

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
| `locate` | Resolve an existing packet, run folder, or file to a local absolute path, a Drive link, or a commit-pinned git location. |
| `doctor` | Report the driver tool version, the credential source, and the resolved remote. |

All seven commands work through the same packet operations with any configured driver. The `fs`
driver uses the local filesystem directly; the `gdrive` driver spawns the pinned rclone binary; the
`git` driver clones the branch into a temporary directory for each operation, then commits and
pushes what a write changed.

For the `git` driver, every reported location is `<remote>#<ref>`, followed by `:<path>` when there is
a path: git's own `treeish:path` grammar inside a URL fragment. `locate` reports
`<remote>#<commit>:<path>`, and `doctor` reports the store root as `<remote>#<branch>`, plus
`:<prefix>` when a prefix is configured. A `locate` result is commit-pinned and provider-neutral, so
`git show <commit>:<path>` resolves the exact bytes in any clone of that remote, with no web UI or
host convention assumed.

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

To check that your own documentation and validators cover every driver, read the driver list from
the package root instead of repeating it:

```js
import { DRIVERS } from '@doruksahin/task-packet-store';
```

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

Git repository:

```json
{
  "driver": "git",
  "remote": "ssh://git@github.com/team/packets.git",
  "branch": "main",
  "prefix": "packets",
  "identity": ["00 Packet.md", "task.md", "jira/**"]
}
```

- `identity` defaults to the three entries shown. An entry is an exact file or `dir/**`.
- `prefix` is optional, with no leading or trailing slash.
- `remote` is an `https://`, `ssh://`, or `file://` URL. The scp-style `host:path` form is rejected.
- `branch` is optional and defaults to `main`. A remote without that branch yet gets it on the first write.

Credentials for the `gdrive` driver come from the process environment only. Set exactly one of:

| Variable | Use |
| --- | --- |
| `PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS` | CI. The service account key JSON, inline. |
| `PACKET_STORE_DRIVE_TOKEN` | Laptop. The output of `rclone authorize "drive"`. |

The `fs` driver needs neither. Do not put these values in the configuration file, command
arguments, or source control.

The `git` driver uses git's own credentials: the SSH agent or the credential helper git is already
configured with. It reads no package-scoped variable and passes nothing to git beyond the remote URL
you configured; a `remote` that embeds a password is rejected when the configuration is read.
`GIT_TERMINAL_PROMPT=0` disables git's own terminal prompt over https; an askpass helper the
environment supplies (`GIT_ASKPASS`, `SSH_ASKPASS`, or `core.askPass`) still runs, because the driver
keeps the ambient credential surface. Over ssh, an unknown host key or a key passphrase can still
prompt or hang; disable that in your own ssh configuration — `ssh-keyscan` the host into
`known_hosts`, or set `GIT_SSH_COMMAND='ssh -o BatchMode=yes'` / `core.sshCommand` — the driver does
not override your ssh command. The driver also sets `LC_ALL=C` so git's diagnostics are the English
strings it matches. The rest of the environment reaches git as it is, except the variables that would
point git at another repository (`GIT_DIR` and its relatives) or override the driver's fixed commit
identity (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`, `GIT_CONFIG*`), which the driver removes.

## Documentation

- [Operator playbook](docs/playbook.md): commands, inputs, and outputs for Drive or filesystem storage.
- [Integrate another workflow](docs/integrating-a-workflow.md): reuse store selection around ordinary input/output files.
- [Design](docs/design/README.md): the 30-second overview, the architecture, and the CLI contract.
- [Plan](docs/plan/README.md): completed delivery, acceptance evidence, and optional follow-ups.
- [Documentation maintenance](docs/maintenance.md): architecture changes, lychee, and required checks.
