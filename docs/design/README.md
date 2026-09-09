# task-packet-store design

## 30-second overview

A task packet is a directory identified by a Jira ticket, containing the task source and stage
outputs. Its persistent home is a configured local directory, a Google Shared Drive, or a branch of
a git repository.

- One npm package, `@doruksahin/task-packet-store`, with one CLI, `task-packet-store`.
- Three transports: `fs` for a configured directory, `gdrive` through pinned rclone, and `git`
  through a temporary clone of a remote branch.
- Shared operations: `fetch`, `push`, `begin`, `checkpoint`, and `pull`; `doctor` reports setup.
- Tool output lives under `stages/NN-slug/runs/vN/` in the selected store.
- Workflows process ordinary files in a working directory. No storage choice requires a vault.

The flow has two independent commands: Jira → saved packet, then stored packet →
AC-walkthrough → saved HTML. The [Jira producer](https://github.com/doruksahin/jira-to-packet/blob/main/README.md)
owns the first command; AC owns the second. Both accept the same selected store.

To operate it, follow the [end-to-end playbook](../playbook.md): commands in order, inputs, outputs,
and where to open the saved packet and report.

The [plan board](../plan/README.md) preserves the initial CI delivery and live acceptance.
The playbook identifies the current command owners and any deployment setup still required.

## Map

The [architecture entry page](../architecture/README.md) connects these detailed contracts to
the ecosystem model and common repository checks.

| Document | Read it when |
| --- | --- |
| [00-decisions.md](00-decisions.md) | You need the decisions and the latest delivery revision. |
| [01-context.md](01-context.md) | You need the original repository survey and packet shape. |
| [02-options.md](02-options.md) | You need the storage alternatives and tradeoffs. |
| [03-architecture.md](03-architecture.md) | You implement or consume the package: configuration, CLI, records, and rules. |
| [04-server-operation.md](04-server-operation.md) | You install and authenticate the tools on a runner. |
| [05-risks-and-scope.md](05-risks-and-scope.md) | You need the delivery scope, accepted risks, and follow-ups. |
| [06-workflow-adapters.md](06-workflow-adapters.md) | You connect another workflow to the same filesystem/Drive selection. |
| [../plan/README.md](../plan/README.md) | You select and execute the next eligible implementation step. |

## Decisions in one table

| # | Decision | Chosen |
| --- | --- | --- |
| D1 | Storage backend | Configured Google Shared Drive or persistent filesystem directory |
| D2 | Drive transport | Pinned rclone, invoked by the package |
| D3 | Drive authentication | Service account in CI; personal OAuth for optional local Drive access |
| D4 | Run layout | `stages/NN-slug/runs/vN/` |
| D5 | Runs in optional vault Git | Ignored; the selected store holds tool output |
| D6 | Run record | `run.md` with YAML frontmatter |
| D7 | Repository | `github.com/doruksahin/task-packet-store` |
| D8 | Run numbering | `vN` from store listing, conflict check at checkpoint |
| D9 | Packet identity | Digest over `00 Packet.md`, `task.md`, and `jira/**` |
| D10 | Deferred work | Seal, blueprint schema change, Git/LFS storage |
| D11 | Required operator flow | Two CI commands, actual Drive links, no required local vault |
| D12 | Reuse across workflows | Explicit shared store config and consumer adapters around ordinary files |
| D13 | Git driver | Vanilla git transport around a temporary clone; LFS management stays out of scope |

The [plan's execution protocol](../plan/README.md#how-to-execute-a-step) is the single source for
checkpoint statuses and evidence. Completed foundation documents retain their historical evidence;
optional work does not block the required delivery.
