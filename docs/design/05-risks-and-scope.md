# Risks, scope, follow-ups

## Risks accepted for the PoC

| Risk | Effect | Mitigation in the PoC |
| --- | --- | --- |
| Two CI runs pick the same `vN` | One run overwrites the other's files | `checkpoint` compares `run_key` in the remote `run.md` and fails |
| Drive listing lag | `begin` sees a stale `runs/` list | Same conflict check |
| Service account quota | Uploads fail in My Drive | Shared Drive only |
| Shared rclone client id | Slow under load, 403 rate errors | rclone retries. Company client id is a follow-up |
| rclone binary drift | Behavior changes between versions | Pinned download with checksum in CI, `doctor` reports the version |
| Teammates do not see runs | Runs are not in Git | `pull` command. A Work OS button is a follow-up |
| Vault already commits `jira/attachments/*` binaries | Repository growth, unrelated to this PoC | Out of scope. The Drive zone can absorb it later |

## Out of scope

- Creating a packet in CI when none exists. The exporter spec keeps packet creation outside.
- A vault GitHub Action that mirrors `10 Tasks/Packets/**` to Drive on every push. It replaces the
  manual `push` later.
- A Work OS "Pull runs" command.
- A `stageRuns` entry in `blueprint.md`. Needs a Work OS parser change.
- A company Google OAuth client id.
- Changes to Jira publishing.
- Migration of existing walkthrough history in `ac-walkthrough-artifacts`.
- `seal`.

## Follow-ups after the PoC

1. Vault mirror Action: `task-packet-store push` for every packet changed on `main`.
2. Work OS command that runs `pull` for the open packet.
3. Blueprint schema version 3 with `generated.stageRuns`.
4. `seal` when a reviewer needs to freeze a run.
5. Company OAuth client id for rclone.
6. Retire `ac-walkthrough-artifacts` and the walkthrough's Git adapter once every consumer uses the
   packet store.
