# task-packet-store delivery plan

**Goal:** A user creates a task packet from Jira on Google Drive, then runs AC-walkthrough against
that stored packet and receives a link to the HTML report on Drive.

[Required commands and outputs](00-required-operator-flow.md) define the operator contract.
[Architecture](../design/03-architecture.md) defines the package contract. Step documents define
bounded implementation work. This revision plans the work; it does not implement the workflows.

## Current state and next action

The storage core is implemented. Steps 03–05 contain its completed evidence, including a real
Shared Drive round trip in step 05. They are preserved unchanged.

**Delivery is in progress.** CI access, result locations, and packet preparation are delegated to
isolated tasks; the orchestrator owns integration and release. See the
[delivery run record](DELIVERY-RUN.md) for assignments, PRs, and current evidence. Publication and
final acceptance remain gated on the required live checks.

## Required delivery sequence

| Step | Work | Owner / repository | Depends on | Status |
| --- | --- | --- | --- | --- |
| 01 | [CI access and shared configuration](01-google-workspace.md) | Administrator + AC-visual-walkthrough | 03–05 | in-progress |
| 05a | [Result locations and Drive links](05a-result-locations.md) | task-packet-store | 05; 01 for live proof | in-progress |
| 06 | [Publish the consumer release](06-release.md) | task-packet-store + npm maintainer | 01, 05a | in-progress |
| 08 | [Jira → packet on Drive](08-jira-to-drive.md) | AC-visual-walkthrough | 01, 06 | in-progress |
| 09 | [Drive packet → walkthrough → Drive report](09-walkthrough-pr.md) | AC-visual-walkthrough | 08 | pending |
| 10 | [Prove both commands and repeat the walkthrough](10-drive-acceptance.md) | AC-visual-walkthrough + Drive | 08, 09 | pending |

Step 05a's implementation can start while step 01 is being completed; its live link proof uses
step 01's access. Packet preparation in step 08 can be developed against fixtures earlier, but
the step is complete only after the released tools succeed in CI.

The release follows result-link support so the workflows can consume one pinned package version.
The delivery is complete only when step 10 has evidence for both commands and preserved run history.

## Completed foundation

| Step | Work | Status |
| --- | --- | --- |
| 03 | [Repository skeleton](03-repo-skeleton.md) | done |
| 04 | [Config, identity, fs transport, fetch, push](04-fetch-and-push.md) | done |
| 05 | [rclone transport, begin, checkpoint, pull](05-runs.md) | done |

Completed step documents are implementation history. Their old environment-specific examples do
not add dependencies to the required delivery sequence.

## Optional integrations and later work

These items do not block step 10.

| Step | Work | Owner / repository | Depends on | Status |
| --- | --- | --- | --- | --- |
| 02 | [Optional local Drive access](02-local-rclone.md) | Individual operator | 01, 06 | pending |
| 07 | [Optional vault integration](07-vault-pr.md) | adc-vault | 06, 10; 02 for local Drive access | pending |
| 11 | [Recon as second consumer](11-recon-consumer.md) | recon-plugin | 06, 10 | pending |
| 12 | [Retire unused walkthrough storage code](12-cleanup.md) | AC-visual-walkthrough | 10 | pending |

Local-only storage remains a supported choice. Package changes must work through both transports;
packet preparation takes explicit filesystem paths. A user command for a completely local run can
be specified later using those same steps.

## How to execute a step

1. Read the operator contract and the selected step. Work from any checkout of its named repository;
   absolute paths in completed historical documents are not prerequisites.
2. Check dependency evidence. If access or input is missing, record the exact missing item in the
   step's Evidence section and use `blocked`. Continue only independent work.
3. Set the selected step to `in-progress`, update this board, and commit the checkpoint. Create
   implementation branches with the `codex/` prefix.
4. Complete the listed work and its verification. Record exact commands, commit/package versions,
   workflow run URLs, and result paths or links. Evidence contains outcomes, never credentials.
5. Mark `done` only when every completion criterion is evidenced. Update this board and commit the
   step and board together. A merged PR or a dispatch confirmation alone is not runtime proof.

Statuses are `pending`, `in-progress`, `done`, and `blocked`. A later session selects the first
eligible unfinished step in the required sequence, rather than the lowest-numbered optional step.
If a partial change is resumed, inspect its existing PR and evidence before creating another.

Run `pnpm check` after changes in this repository and `pnpm release:check` before a release
candidate. Consumer work follows the consumer repository's own checks. Planning-only edits leave
implementation statuses and existing runtime evidence unchanged.
