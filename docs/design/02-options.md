# Options considered (historical)

> **Historical decision record.** These are the alternatives evaluated before the
> initial storage delivery on 2026-09-04. References to the former R2 and vault
> paths explain that decision; they are not current operator guidance. Use the
> [operator playbook](../playbook.md) for the supported filesystem/Google Drive
> flow and the [architecture page](../architecture/README.md) for current ownership.

## Where the packet store lives

| Option | Ingress on CI | Egress from CI | Cost | Verdict |
| --- | --- | --- | --- | --- |
| A. Vault Git repository is the store | sparse checkout at a commit | commit into `runs/`, push with retry | LFS in the vault, write token, teammates need git-lfs | Rejected by Doruk on 2026-09-04 |
| B. Google Shared Drive or configured local fs | package `push` / `fetch` | package `checkpoint` | For Drive: pinned rclone and CI service account; packet preparation runs in CI | **Chosen** |
| C. Extend R2 with egress | exists | PutObject, then a sync job into the vault | two copies of every packet, an uploader, a sync job | Rejected |
| D. Jira as the bus (status quo) | exporter refresh | Jira attachment | lossy, size limits, not diffable | Rejected |

## How the package talks to Google Drive

| Option | What we own | What we get | Verdict |
| --- | --- | --- | --- |
| rclone, pinned, spawned by the package | env mapping, connection string, packet rules, one install step per runner | listing, upload, download, MD5 verification, retries, pagination, Shared Drive support, a local backend for tests | **Chosen** |
| `@googleapis/drive` in Node | folder lookup by name, create-if-missing races, resumable upload, pagination, backoff, duplicate names. About 400 to 600 lines plus fakes | no binary to install | Rejected for the PoC. Kept as the fallback behind the transport interface |
| `rclone rcd` daemon with HTTP remote control | a daemon lifecycle | no process spawn per command | Not needed for one-shot jobs |
| Google Drive for Desktop sync folder | nothing | transparent local sync | Not usable in CI. Conflicts with Git on the vault |

## What ADR-0015 said and what changed

ADR-0015 in AC-visual-walkthrough rejected `rclone copy` in workflow files for two reasons: an
external binary outside a lockfile, and frozen-packet semantics that turn into flag conventions
spread over YAML. Doruk accepted the first cost on 2026-09-04. The second is removed by design: the
package owns the excludes, the read-only files, the refusal of an existing destination, the digest,
the run numbering, the env mapping, and the JSON output. The workflow calls `task-packet-store fetch`
and `task-packet-store checkpoint`, not rclone.

## Digest scope

| Option | Effect |
| --- | --- |
| Whole packet (current) | Every run changes the identity of the packet it read |
| Identity zone `00 Packet.md`, `task.md`, `jira/**` | Runs and sessions do not change the identity. Same formula as the walkthrough | **Chosen** |
