# Architecture

## Components

```text
User: Jira ticket
  │
  ▼  GitHub Actions: jira-to-packet.yml
Jira exporter → packet preparation → push → Google Shared Drive
                                              packets/PROJ-123/
                                                    │
  ┌──────────────────────── fetch ───────────────────┘
  ▼  GitHub Actions: walkthrough-lab.yml (a separate run)
Temporary packet → begin → AC-walkthrough → checkpoint → Google Shared Drive
                                              stages/20-ac-walkthrough/runs/vN/
                                              HTML + evidence + run records
```

The first workflow is owned by the independent
[Jira producer](https://github.com/doruksahin/jira-to-packet/blob/main/.github/workflows/jira-to-packet.yml);
the second is owned by
[AC-walkthrough](https://github.com/doruksahin/task-packet-store/blob/main/docs/playbook.md#run-through-github-actions).
The [current operator playbook](../playbook.md) describes setup and commands. Each workflow reports
the actual saved result location; the [delivery plan](../plan/README.md) retains historical proof.
A vault can optionally fetch packets and pull runs afterward.

Both storage backends use the same file-processing steps. The Drive workflow uses temporary
runner files and a persistent Shared Drive; a local workflow uses a configured persistent directory
accessible to its process. Storage choice does not imply a particular person's machine or a vault.

Inside the package:

```text
cli.ts ─► operations.ts ─► PacketTransport ─┬─► FsTransport      (node:fs)
   │            │                           ├─► RcloneTransport  (spawns rclone)
   │            │                           └─► GitTransport     (spawns git; FsTransport in the clone)
   │            ├─► identity.ts   packetSha256 over identity globs
   │            ├─► run-record.ts run.md frontmatter, snapshot.json, state file
   │            └─► glob.ts       anchored glob matcher for fs filters
   └─► config.ts  zod schema, credential-free
```

`operations.ts` is written once against `PacketTransport`. The transports differ only in how bytes
move and existing locations are resolved. `GitTransport` adds no file handling of its own: it clones
the branch for one operation, delegates every read, copy, and path-safety rule to an `FsTransport`
rooted at that clone, commits and pushes what a write changed, and removes the clone. Tests exercise
the same operations through every transport.

## Configuration

One JSON file, credential-free, committable. Unknown keys are rejected.

```json
{
  "driver": "gdrive",
  "sharedDriveId": "0ABcDeFgHiJkLmNoPqR",
  "prefix": "packets",
  "identity": ["00 Packet.md", "task.md", "jira/**"]
}
```

```json
{
  "driver": "fs",
  "root": "/absolute/path/to/packets",
  "identity": ["00 Packet.md", "task.md", "jira/**"]
}
```

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
- `prefix` is optional, no leading or trailing slash.
- `remote` is an `https://`, `ssh://`, or `file://` URL; scp-style `host:path` is rejected. `branch`
  is one path segment and defaults to `main`.
- The runs glob is a constant, `/stages/*/runs/**`. It is not configurable in the PoC.

## Credentials

| Env var you set | Mapped to rclone | Who |
| --- | --- | --- |
| `PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS` | `RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS` | CI. The key JSON inline |
| `PACKET_STORE_DRIVE_TOKEN` | `RCLONE_DRIVE_TOKEN` | OAuth token JSON, on a developer host or CI runner |
| `PACKET_STORE_DRIVE_CLIENT_ID` | `RCLONE_DRIVE_CLIENT_ID` | Optional dedicated OAuth client; paired with its secret and token |
| `PACKET_STORE_DRIVE_CLIENT_SECRET` | `RCLONE_DRIVE_CLIENT_SECRET` | Optional dedicated OAuth client secret |

Exactly one of the service-account credentials or OAuth token must be set for the `gdrive` driver.
With an OAuth token, callers may set both client variables to use their own Google project's
OAuth client. The token must have been authorized with that same client. Omitting both client
variables preserves rclone's default client behavior; empty optional variables also mean omitted.
An incomplete or whitespace-only client pair, or a pair alongside service-account credentials,
fails with `STORE_CONFIG_INVALID` (exit 2) before invoking rclone. Mapping uses the child environment,
not command arguments or output receipts; validation errors name variables without their values. The
[rclone Drive options](https://rclone.org/drive/#drive-client-id) own OAuth behavior and quotas.

The `fs` driver needs none. The package removes
every ambient `RCLONE_*` variable before it spawns rclone and sets `RCLONE_DRIVE_SCOPE=drive`.

The `git` driver has no package-scoped credential variable. The ambient credential surface reaches
git as it is, so the SSH agent and any configured credential helper work as they already do, but the
driver removes what would point git at another repository (`GIT_DIR`, `GIT_WORK_TREE`,
`GIT_INDEX_FILE`, and their relatives) or override its fixed commit identity (`GIT_AUTHOR_*`,
`GIT_COMMITTER_*`, `GIT_CONFIG*`). `GIT_TERMINAL_PROMPT=0` disables git's own terminal prompt over
https; an askpass helper the environment supplies (`GIT_ASKPASS`, `SSH_ASKPASS`, or `core.askPass`)
still runs, because the driver keeps the ambient credential surface. Over ssh, an unknown host key or
a key passphrase can still prompt or hang; disable that in your own ssh configuration —
`ssh-keyscan` the host into `known_hosts`, or set `GIT_SSH_COMMAND='ssh -o BatchMode=yes'` /
`core.sshCommand` — the driver does not override your ssh command. `LC_ALL=C` keeps git's diagnostics
in the English the driver matches. It reads no package-scoped variable and passes nothing to git
beyond the configured `remote`, and a `remote` that embeds a password is rejected when the
configuration is read.

The remote is a connection string, so no `rclone.conf` exists anywhere:

```text
:drive,team_drive=<sharedDriveId>:<prefix>/<TICKET>
```

## CLI contract

On success every command prints exactly one JSON object on stdout and exits `0`. On failure stdout
is empty and stderr has one line `CODE: message`. Exit `2` is a usage or configuration error. This
includes the usage errors commander detects itself, such as an unknown command, a missing required
option, or no arguments at all; for those, commander writes its own message and the help text to
stderr. Exit `1` is everything else. Help and version requests exit `0`.

### fetch

```text
task-packet-store fetch --store <abs cfg> --ticket <TICKET> --destination <abs dir>
```

Downloads the packet without `/stages/*/runs/**` into `<destination>/<TICKET>`. The directory must
not exist. Files are written `0444`. A failed fetch removes the partial directory.

```json
{ "ticket": "PROJ-123", "packetDirectory": "/abs/packets/PROJ-123", "fileCount": 23,
  "packetSha256": "9f…", "driver": "gdrive" }
```

### push

```text
task-packet-store push --store <abs cfg> --ticket <TICKET> --from <abs packet dir>
```

Uploads the packet from an explicit local working directory without `/stages/*/runs/**`. Copy,
never delete. With the `fs` driver, `--from` must differ from `<root>/<TICKET>`.

```json
{ "ticket": "PROJ-123", "driver": "gdrive", "from": "/abs/work/packets/PROJ-123" }
```

### begin

```text
task-packet-store begin --store <abs cfg> --ticket <TICKET> --stage <NN-slug> --run-key <key> \
  --tool <name@version> [--packet-sha256 <hex>] --state <abs file>
```

Lists `stages/<NN-slug>/runs/` on the remote, picks the next `vN`, uploads `run.md`, writes the state
file. The state file must not exist.

```json
{ "ticket": "PROJ-123", "stage": "20-ac-walkthrough", "version": "v1", "runKey": "17012345678",
  "runDirectory": "stages/20-ac-walkthrough/runs/v1", "stateFile": "/abs/run-state.json" }
```

### checkpoint

```text
task-packet-store checkpoint --state <abs file> --reason <text> --source <abs dir>
```

Reads the remote `run.md`. Fails with `STORE_VERSION_CONFLICT` when its `run_key` differs. Uploads
`<source>` into the run directory with checksum comparison, so unchanged files are skipped. Writes
`snapshot.json` last. Updates the state file.

```json
{ "version": "v1", "reason": "evidence-captured", "fileCount": 41, "inventorySha256": "3c…" }
```

### pull

```text
task-packet-store pull --store <abs cfg> --ticket <TICKET> --into <abs packet dir>
```

Downloads `stages/*/runs/**` from the remote into the local packet. Merges. Never deletes.

```json
{ "ticket": "PROJ-123", "driver": "gdrive", "into": "/abs/vault/10 Tasks/Packets/PROJ-123" }
```

### doctor

```text
task-packet-store doctor --store <abs cfg>
```

Reports the driver's tool version, the credential source, and the resolved remote root. Makes no
network call.

### locate

```text
task-packet-store locate --store <abs cfg> --ticket <TICKET> [--path <packet-relative-path>]
```

Read-only lookup of an existing packet folder, run folder, or file. Omitted `--path` and the empty
string identify the packet folder. A nonempty path uses slash-separated segments, with no leading,
trailing, or doubled slash, `.`/`..`, backslash, NUL, or control characters. Spaces in names are
allowed. Lookup does not require packet identity files or inspect file contents.

```sh
task-packet-store locate --store /abs/store.json --ticket PROJ-123
task-packet-store locate --store /abs/store.json --ticket PROJ-123 \
  --path stages/20-ac-walkthrough/runs/v1
task-packet-store locate --store /abs/store.json --ticket PROJ-123 \
  --path stages/20-ac-walkthrough/runs/v1/delivery/report.html
```

Success returns exactly these keys; `kind` is `directory` or `file`, and `relativePath` is the
supplied packet-relative path (empty for the packet folder):

```json
{ "ticket": "PROJ-123", "driver": "gdrive", "relativePath": "stages/20-ac-walkthrough/runs/v1/delivery/report.html",
  "kind": "file", "location": "https://drive.google.com/file/d/<observed-object-id>/view" }
```

For `fs`, `location` is the existing absolute path, such as
`/abs/packets/PROJ-123/stages/20-ac-walkthrough/runs/v1/delivery/report.html`. No rclone or Drive
authentication is used. Symlinks within the packet path and non-regular files are rejected with
`STORE_PACKET_UNSAFE`; the configured store root itself may be a symlink.

For `git`, `location` is `<remote>#<commit>:<path>`, such as
`ssh://git@github.com/team/packets.git#4d9f…:packets/PROJ-123/stages/20-ac-walkthrough/runs/v1/delivery/report.html`.
The fragment is git's own `treeish:path` grammar, so the location is commit-pinned and
provider-neutral: `git show <commit>:<path>` resolves the same bytes in any clone of that remote, and
no web UI or host URL convention is assumed. The commit is the `HEAD` of the clone the lookup read.

For `gdrive`, the transport first checks the parent's directory type with `rclone lsjson --stat`,
then lists that directory with `rclone lsjson` and matches the object's exact name. It uses the observed `ID` and `IsDir` to return
`https://drive.google.com/drive/folders/<observed-object-id>` for directories or the file URL above.
No ID is inferred from a path. A file parent returns missing: rclone can otherwise list a file as
its own entry and falsely match a nonexistent child of the same name. Missing or malformed parent
type metadata fails. The stat response is used only for directory type; listing the parent obtains
the actual object ID instead of relying on the synthetic root entry that `lsjson --stat` can return. Lookup never invokes `rclone link`, changes sharing permissions,
or writes content. Existing authorized readers can use the link; it does not grant access or host
HTML as a website. The file link lets a reader retrieve the saved HTML.

The lookup relies on rclone's documented [lsjson fields](https://rclone.org/commands/rclone_lsjson/)
and the pinned version's [directory stat behavior](https://github.com/rclone/rclone/blob/v1.75.0/fs/operations/lsjson.go).

Missing objects (including an absent parent) fail with `STORE_LOCATION_MISSING` (exit 1). Duplicate
matching names or missing/invalid ID/type metadata fail with `STORE_RCLONE_FAILED` (exit 1), never
a guessed URL. Invalid ticket/path/configuration fails with `STORE_CONFIG_INVALID` (exit 2).
Authentication and rclone failures retain their existing codes. Failures leave stdout empty and
write one `CODE: message` line to stderr.

Library API: `locateResult(transport, ticket, relativePath = ''): Promise<LocationResult>`, exported
from the package root. `LocationResult` contains the five success keys above. The shared operation
validates inputs and calls `PacketTransport.locate(ticket, relativePath)`, which returns
`Promise<ResultLocation | null>`; `ResultLocation` is `{ kind: 'directory' | 'file', location: string }`.
`null` means missing. Backend-specific lookup lives only in the transports.

The interface contract is recorded before implementation in step 05a. Both user workflows consume
this interface rather than invoking rclone directly. Transfer commands, filters, credential
handling, and digest semantics remain unchanged.

## Layout in the selected store

```text
packets/PROJ-123/
  00 Packet.md  task.md  jira/**  stages/*/README.md ...     <- push, from preparation
  stages/20-ac-walkthrough/runs/v1/
    run.md            record: see below
    snapshot.json     manifest of the latest checkpoint
    input/ delivery/ evidence/                              <- checkpoint --source
```

## Records

`run.md`, written once by `begin`:

```markdown
---
type: stage-run
jira_key: PROJ-123
stage_folder: 20-ac-walkthrough
stage_id: ac-walkthrough
version: v1
run_key: "17012345678"
tool: ac-walkthrough@6.0.0
packet_sha256: 9f…
started_at: 2026-09-04T09:12:33.120Z
---

# PROJ-123 · ac-walkthrough · v1

Generated by task-packet-store. Do not edit.
```

`snapshot.json`, replaced by every `checkpoint`:

```json
{ "schemaVersion": 1, "reason": "report-rendered", "checkpointAt": "2026-09-04T09:40:01.002Z",
  "fileCount": 41, "inventorySha256": "3c…",
  "files": [ { "path": "delivery/PROJ-123-ac-verification-v1.html", "size": 812311, "sha256": "…" } ] }
```

State file, local, written by `begin`, updated by `checkpoint`:

```json
{ "schemaVersion": 1, "storeFile": "/abs/packet-store.json", "ticket": "PROJ-123",
  "stage": "20-ac-walkthrough", "version": "v1", "runKey": "17012345678",
  "runDirectory": "stages/20-ac-walkthrough/runs/v1", "createdAt": "…",
  "latestSnapshot": { "reason": "report-rendered", "inventorySha256": "3c…" } }
```

## Rules the package owns

1. Ticket matches `^[A-Z][A-Z0-9]+-\d+$`. Stage matches `^\d{2}-[a-z][a-z0-9-]*$`.
2. Every downloaded path is checked before the packet is accepted. No absolute paths, no `.` or
   `..` segments, no backslashes, regular files only.
3. `fetch` writes read-only files, refuses an existing destination, and removes a partial download.
4. `fetch` and `push` exclude `/stages/*/runs/**`. `pull` includes only `/*/runs/**` below `stages/`.
5. `packetSha256` is the SHA-256 of the JSON array of `{path, size, sha256}` for identity files,
   sorted by path bytes. Same formula as `run-history.ts` in the walkthrough.
6. A filter has includes or excludes, never both. rclone treats the combination differently across
   versions, so the package refuses it.
7. rclone exit codes 3 and 4 mean "not found". Everything else non-zero is `STORE_RCLONE_FAILED`
   with the last lines of stderr.
8. Credentials never appear in config, state, records, stdout, or stderr.
9. The `git` driver needs git 2.28 or newer on `PATH`. It clones for one operation and keeps no
   persistent clone. A write commits and pushes once; a rejected push is `STORE_GIT_FAILED`, never a
   retry, a rebase, or a force. The driver holds no Git LFS handling: the remote's `.gitattributes`
   and an installed `git-lfs` decide that.

## Error codes

`STORE_CONFIG_INVALID` (exit 2), `STORE_STATE_INVALID` (exit 2), `STORE_AUTH_MISSING`,
`STORE_RCLONE_UNAVAILABLE`, `STORE_RCLONE_FAILED`, `STORE_GIT_UNAVAILABLE`, `STORE_GIT_FAILED`,
`STORE_PACKET_MISSING`, `STORE_PACKET_UNSAFE`,
`STORE_DESTINATION_EXISTS`, `STORE_RUN_MISSING`, `STORE_LOCATION_MISSING`, `STORE_VERSION_CONFLICT`, `STORE_UNEXPECTED` (all
exit 1). Unknown errors are reported under `STORE_UNEXPECTED` so the failure rule holds.

A failure never writes to stdout. It writes exactly one line to stderr, `CODE: message`, where
`CODE` is one of the values above, and exits with the status listed. A caller can therefore treat
any stdout as the success object and any non-zero exit as a failure whose first stderr token is the
code. Usage errors caught by commander carry no `STORE_*` code; see "CLI contract".

## Testing strategy

- Unit tests for config, glob, identity, and records.
- One operations test suite, run three times: through `FsTransport`, through `RcloneTransport` with a
  temporary local directory as the remote, and through `GitTransport` against a temporary bare
  repository reached over `file://`. The rclone and git suites are skipped when their binary is absent
  and are mandatory in CI, which installs the pinned rclone.
- One manual round trip against the real Shared Drive before the first release. Its output goes into
  the evidence of plan step 05.
- The walkthrough repository keeps its cross-package digest contract test and imports
  `packetSha256` from this package.
