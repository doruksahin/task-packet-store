# Decisions

Initial decisions: 2026-09-04. Delivery revision: 2026-09-05, from Doruk's required operator flow.

## D1. Storage backend: Google Shared Drive and local file system

Cloud storage is a Google Shared Drive. Local storage is an explicitly configured persistent
directory accessible to the process. Either may hold the entire packet and its tool output.
A vault checkout is an optional local consumer, not a required source of packets.

Why: Doruk decided on 2026-09-04 to drop Git and Git LFS for file storage and to use Google Drive.
Appier uses Google Workspace, so Shared Drives exist and the team already has access control there.

Rejected: Git plus LFS in the vault repository (the first proposal), Cloudflare R2 (the current
walkthrough-only fetch path), Jira attachments as the transport (the current de-facto path).

Reopen when: the team needs commit-pinned links to tool output, or Google Drive quotas block CI.

## D2. Drive transport: rclone

The package spawns a pinned rclone binary for every Drive operation. It never calls the Drive API
directly.

Why: the Drive API has no paths, only file IDs. A direct client owns folder lookup by name,
create-if-missing races, resumable uploads, pagination, backoff, and duplicate names. rclone owns all
of that, verifies MD5 after each transfer, and can target a local directory as a fake remote for
hermetic tests. This is the same split that ADR-0015 in AC-visual-walkthrough made with the AWS SDK.

Rejected: `@googleapis/drive`. See [02-options.md](02-options.md).

Reopen when: a server cannot run downloaded binaries. Then the fallback is a direct Drive client
inside the same package behind the same transport interface.

## D3. Drive authentication: service account in CI, OAuth token on laptops

CI passes a service account key inline through `PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS`.
A developer passes a personal OAuth token through `PACKET_STORE_DRIVE_TOKEN`, created once with
`rclone authorize "drive"`. The package maps both onto rclone's documented `RCLONE_DRIVE_*` variables
and strips every ambient `RCLONE_*` variable first.

Why: a service account has no storage quota in My Drive, so uploads to a My Drive folder fail. A
Shared Drive gives the account quota through the drive. Inline credentials never touch the runner
disk. Stripping ambient variables mirrors the exporter's refusal of ambient `AWS_*`.

Reopen when: the organization forbids service accounts. Then CI uses a dedicated user's OAuth token.

## D4. Run layout: `stages/NN-slug/runs/vN/`

Every tool run lands in its own numbered folder below the stage it belongs to.

Why: the vault blueprint already defines `stages/NN-slug/` as the task-local workflow stage. A
`runs/` child keeps tool output apart from the human scaffold files in the stage. Numbering per stage
matches how people talk about a report ("v3 of the walkthrough").

Rejected: `stages/NN-slug/vN/` (mixes generated folders with human files), timestamps instead of
numbers (no human-facing version).

## D5. Runs in vault Git: ignored

When the optional vault integration is used, its `.gitignore` gains
`10 Tasks/Packets/*/stages/*/runs/`. Runs live in the selected store and can be retrieved with
`pull`. They do not enter vault Git.

Why: runs carry screenshots and HTML reports. Without LFS they would bloat the vault repository.
Obsidian shows local files whether or not Git tracks them.

Reopen when: the team wants `run.md` records in Git for search across machines. Then commit `run.md`
only and keep the ignore for evidence.

## D6. Run record format: `run.md` with YAML frontmatter

Each run folder holds a `run.md` whose frontmatter is the machine record. A `snapshot.json` beside it
holds the per-file manifest of the latest checkpoint.

Why: the vault rule is "Markdown notes and properties are the source of truth, Bases are
projections". Session records already use this shape. An Obsidian Base can project `type: stage-run`
without any plugin change.

## D7. Repository home: `doruksahin/task-packet-store`

Why: the exporter lives at `doruksahin/jira-markdown-exporter` and publishes to npm under
`@doruksahin`. The same rail, the same npm scope, the same release procedure. The AdCreative
organization consumes an exact pinned version.

## D8. Version numbering: `vN` from a remote listing, conflict check at checkpoint

`begin` lists `runs/` on the remote, picks the next number, and uploads `run.md` with the run key.
`checkpoint` reads the remote `run.md` again and fails when the run key differs.

Why: Drive has no atomic create-if-absent. Two runs on the same ticket and stage at the same second
are rare. The conflict check makes the race visible instead of silent. This is enough for the PoC.

Reopen when: two CI runs collide in practice. Then add a reservation file or a timestamp suffix.

## D9. Packet identity: digest over the identity zone only

`packetSha256` covers `00 Packet.md`, `task.md`, and `jira/**`. Tool runs and session records do not
change it.

Why: the current formula hashes the whole packet. The first tool that writes into the packet would
change the input identity of every later run. The digest formula stays identical to the walkthrough's
`run-history.ts`. Only the file subset changes.

## D10. Dropped for the PoC

- `seal`. Drive has no immutability to enforce, so a seal is a marker file only. Add it when a
  reviewer needs to freeze a run.
- A `stageRuns` entry in the vault `blueprint.md`. The blueprint is a closed schema that the Work OS
  plugin parses fail-closed. Adding a key needs a Work OS parser change and tests. Deferred.
- Git and LFS storage in any form.

## D11. Two operator commands, independent of a local vault

The first GitHub Actions workflow exports Jira, prepares a complete packet, and pushes it to Drive.
The second fetches that stored packet, runs the existing walkthrough, and checkpoints the HTML and
evidence to Drive. Both report actual result links. Acceptance starts with an absent packet and
includes a repeat walkthrough that preserves the first run.

Why: the user requires the flow to work without their machine. The preparation script and templates
belong to the consumer repository; the exporter owns only its Jira output, and the store owns
storage operations. See [the exact commands and outputs](../plan/00-required-operator-flow.md).

This supersedes the original PoC's manual vault upload and mandatory Obsidian verification. Local
Drive access, vault integration, and Recon are outside the first delivery's dependencies. The
existing lab target and draft-report behavior remain the first proof's walkthrough scope.

## D12. Reuse one store config through consumer adapters

The operator passes the same explicit store configuration to each packet-based workflow. Each
consumer's small adapter connects the published package operations to ordinary input/output
directories and returns the actual saved result locations. Filesystem and Drive use the same
processing and delivery sequence. The execution host is chosen independently of storage.

Why: the user requested reuse in other workflows/plugins on 2026-09-05. The existing published
operations already provide the required transport, reservation, persistence, and result lookup;
independent contract review found no missing primitive. The next delivery makes the walkthrough
runner portable and integrates Recon dossier delivery as the second consumer.

See [the adapter contract](06-workflow-adapters.md) and
[the active delivery plan](../plan/README.md#active-delivery-reusable-workflow-storage).
