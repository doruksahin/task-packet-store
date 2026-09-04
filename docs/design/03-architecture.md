# Architecture

## Components

```text
                 laptop                                        GitHub Actions runner
  ┌──────────────────────────────────┐               ┌──────────────────────────────────────┐
  │ adc-vault checkout               │               │ task-packet-store fetch   (gdrive)   │
  │  10 Tasks/Packets/ATT-5387/      │   push        │   -> $RUNNER_TEMP/packets/ATT-5387   │
  │    00 Packet.md task.md jira/    │ ───────────►  │ ac-walkthrough plugin reads it       │
  │    stages/*/README.md            │               │ task-packet-store begin              │
  │    stages/*/runs/  (git-ignored) │ ◄───────────  │ task-packet-store checkpoint x N     │
  │                                  │   pull        │   -> Drive: .../runs/v1/**           │
  └──────────────────────────────────┘               └──────────────────────────────────────┘
                     ▲                                                  │
                     │        Google Shared Drive "ADC Task Packets"    │
                     └──────────────  packets/ATT-5387/**  ◄────────────┘
```

Inside the package:

```text
cli.ts ─► operations.ts ─► PacketTransport ─┬─► FsTransport      (node:fs)
   │            │                           └─► RcloneTransport  (spawns rclone)
   │            ├─► identity.ts   packetSha256 over identity globs
   │            ├─► run-record.ts run.md frontmatter, snapshot.json, state file
   │            └─► glob.ts       anchored glob matcher for fs filters
   └─► config.ts  zod schema, credential-free
```

`operations.ts` is written once against `PacketTransport`. The two transports differ only in how
bytes move. Tests exercise the same operations through both transports.

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
  "root": "/Users/doruk/Desktop/ADCREATIVE/adc-vault/10 Tasks/Packets",
  "identity": ["00 Packet.md", "task.md", "jira/**"]
}
```

- `identity` defaults to the three entries shown. An entry is an exact file or `dir/**`.
- `prefix` is optional, no leading or trailing slash.
- The runs glob is a constant, `/stages/*/runs/**`. It is not configurable in the PoC.

## Credentials

| Env var you set | Mapped to rclone | Who |
| --- | --- | --- |
| `PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS` | `RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS` | CI. The key JSON inline |
| `PACKET_STORE_DRIVE_TOKEN` | `RCLONE_DRIVE_TOKEN` | Laptop. Output of `rclone authorize "drive"` |

Exactly one must be set for the `gdrive` driver. The `fs` driver needs none. The package removes
every ambient `RCLONE_*` variable before it spawns rclone and sets `RCLONE_DRIVE_SCOPE=drive`.

The remote is a connection string, so no `rclone.conf` exists anywhere:

```text
:drive,team_drive=<sharedDriveId>:<prefix>/<TICKET>
```

## CLI contract

Every command prints exactly one JSON object on stdout. Diagnostics go to stderr. Exit `0` is
success. Exit `1` is a runtime failure. Exit `2` is a usage or configuration error.

### fetch

```text
task-packet-store fetch --store <abs cfg> --ticket <TICKET> --destination <abs dir>
```

Downloads the packet without `/stages/*/runs/**` into `<destination>/<TICKET>`. The directory must
not exist. Files are written `0444`. A failed fetch removes the partial directory.

```json
{ "ticket": "ATT-5387", "packetDirectory": "/abs/packets/ATT-5387", "fileCount": 23,
  "packetSha256": "9f…", "driver": "gdrive" }
```

### push

```text
task-packet-store push --store <abs cfg> --ticket <TICKET> --from <abs packet dir>
```

Uploads the packet from the vault checkout without `/stages/*/runs/**`. Copy, never delete. With the
`fs` driver, `--from` must differ from `<root>/<TICKET>`.

```json
{ "ticket": "ATT-5387", "driver": "gdrive", "from": "/abs/vault/10 Tasks/Packets/ATT-5387" }
```

### begin

```text
task-packet-store begin --store <abs cfg> --ticket <TICKET> --stage <NN-slug> --run-key <key> \
  --tool <name@version> [--packet-sha256 <hex>] --state <abs file>
```

Lists `stages/<NN-slug>/runs/` on the remote, picks the next `vN`, uploads `run.md`, writes the state
file. The state file must not exist.

```json
{ "ticket": "ATT-5387", "stage": "20-ac-walkthrough", "version": "v1", "runKey": "17012345678",
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
{ "ticket": "ATT-5387", "driver": "gdrive", "into": "/abs/vault/10 Tasks/Packets/ATT-5387" }
```

### doctor

```text
task-packet-store doctor --store <abs cfg>
```

Reports the rclone version, whether exactly one credential variable is set, and the resolved remote
root. Makes no network call.

## Layout on Drive and, after pull, in the vault

```text
packets/ATT-5387/
  00 Packet.md  task.md  jira/**  stages/*/README.md ...     <- push, from the vault
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
jira_key: ATT-5387
stage_folder: 20-ac-walkthrough
stage_id: ac-walkthrough
version: v1
run_key: "17012345678"
tool: ac-walkthrough@6.0.0
packet_sha256: 9f…
started_at: 2026-09-04T09:12:33.120Z
---

# ATT-5387 · ac-walkthrough · v1

Generated by task-packet-store. Do not edit.
```

`snapshot.json`, replaced by every `checkpoint`:

```json
{ "schemaVersion": 1, "reason": "report-rendered", "checkpointAt": "2026-09-04T09:40:01.002Z",
  "fileCount": 41, "inventorySha256": "3c…",
  "files": [ { "path": "delivery/ATT-5387-ac-verification-v1.html", "size": 812311, "sha256": "…" } ] }
```

State file, local, written by `begin`, updated by `checkpoint`:

```json
{ "schemaVersion": 1, "storeFile": "/abs/packet-store.json", "ticket": "ATT-5387",
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

## Error codes

`STORE_CONFIG_INVALID` (exit 2), `STORE_STATE_INVALID` (exit 2), `STORE_AUTH_MISSING`,
`STORE_RCLONE_UNAVAILABLE`, `STORE_RCLONE_FAILED`, `STORE_PACKET_MISSING`, `STORE_PACKET_UNSAFE`,
`STORE_DESTINATION_EXISTS`, `STORE_RUN_MISSING`, `STORE_VERSION_CONFLICT` (all exit 1).

## Testing strategy

- Unit tests for config, glob, identity, and records.
- One operations test suite, run twice: through `FsTransport`, and through `RcloneTransport` with a
  temporary local directory as the remote. The second suite is skipped when rclone is absent and is
  mandatory in CI, which installs the pinned rclone.
- One manual round trip against the real Shared Drive before the first release. Its output goes into
  the evidence of plan step 05.
- The walkthrough repository keeps its cross-package digest contract test and imports
  `packetSha256` from this package.
