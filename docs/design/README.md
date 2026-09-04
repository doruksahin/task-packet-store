# task-packet-store design

## 30-second overview

A task packet is the folder `10 Tasks/Packets/<TICKET>/` in the adc-vault Obsidian vault. Today it
reaches a CI runner only through a hand-uploaded R2 copy, and tool results never return to it. This
package closes both gaps.

- One npm package, `@doruksahin/task-packet-store`, with one CLI, `task-packet-store`.
- Two drivers: `fs` for a local checkout and `gdrive` for a Google Shared Drive.
- rclone owns the Drive transport. The package owns the packet rules.
- Five commands: `fetch`, `push`, `begin`, `checkpoint`, `pull`. Every command prints one JSON object.
- Tool output lands under `stages/NN-slug/runs/vN/` inside the packet.
- The vault ignores `runs/` in Git. Git keeps human notes. Drive keeps tool output.

The first consumer is AC-visual-walkthrough in GitHub Actions. The second is the recon plugin.

## Map

Read the documents in order the first time. Later, open only the one you need.

| Document | Read it when |
| --- | --- |
| [00-decisions.md](00-decisions.md) | You want to know what was decided, why, and what reopens a decision. |
| [01-context.md](01-context.md) | You want the evidence from the three repositories that shaped the design. |
| [02-options.md](02-options.md) | You want the rejected alternatives and their trade-offs. |
| [03-architecture.md](03-architecture.md) | You implement or consume the package. Config, CLI contract, layouts, schemas, rules. |
| [04-server-operation.md](04-server-operation.md) | You run the CLI on a GitHub Actions runner or another server. |
| [05-risks-and-scope.md](05-risks-and-scope.md) | You want the known risks, what is out of scope, and the follow-ups. |
| [../plan/README.md](../plan/README.md) | You execute the PoC. One checkpoint document per step. |

## Decisions in one table

| # | Decision | Chosen |
| --- | --- | --- |
| D1 | Storage backend | Google Shared Drive for cloud, local file system for laptops |
| D2 | Drive transport | rclone, pinned version, spawned by the package |
| D3 | Drive authentication | Service account in CI, personal OAuth token on laptops |
| D4 | Run layout | `stages/NN-slug/runs/vN/` |
| D5 | Runs in vault Git | Ignored. Drive is the store for tool output |
| D6 | Run record format | `run.md` with YAML frontmatter |
| D7 | Repository home | `github.com/doruksahin/task-packet-store` |
| D8 | Version numbering | `vN` from a remote listing, conflict check at checkpoint |
| D9 | Packet identity | Digest over `00 Packet.md`, `task.md`, `jira/**` only |
| D10 | Dropped for the PoC | `seal` command, blueprint schema change, Git/LFS storage |

## How to use these documents as checkpoints

Each step in `docs/plan/` is one document with a `status` field in its frontmatter. The values are
`pending`, `in-progress`, `done`, and `blocked`.

1. Before you start a step, set its status to `in-progress` and commit.
2. Do the work that the step lists. Do not do work from a later step.
3. Paste the output of the "Done when" commands into the "Evidence" section of the step.
4. Set the status to `done`. Update the board in `docs/plan/README.md`. Commit both files.

A step is done only when its evidence is in the document. A later session reads the board first and
continues from the first step that is not `done`.
