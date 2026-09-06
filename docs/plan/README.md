# task-packet-store delivery plan

**Goal:** A user selects filesystem or Google Shared Drive storage once, creates a task packet from
Jira, and runs workflows against that packet with reports saved in the same store. AC-walkthrough
and Recon demonstrate the shared selection.

[Required commands and outputs](00-required-operator-flow.md) define the operator contract.
[Architecture](../design/03-architecture.md) defines the package contract. Step documents define
bounded implementation work and record its completion evidence.

For day-to-day use, start with the [operator playbook](../playbook.md), which explains the full
sequence, inputs, outputs, and result locations.

## Current state and next action

The records below describe the original delivery and its verified versions. Current producer
ownership and commands are in the [operator playbook](../playbook.md); the
[extraction plan](https://github.com/doruksahin/plugin-architecture/blob/main/PLAN.md) tracks the
independent producer and the boundary checks. Historical acceptance is not a verification of
new repository credentials or deployment activation.

The storage core is implemented. Steps 03–05 contain its completed evidence, including a real
Shared Drive round trip in step 05. They are preserved unchanged.

**The required Drive delivery is complete and verified as of 2026-09-05.** Store `0.1.0` is
published, both user commands succeeded on independent CI runners, and repeating the walkthrough
created `v2` with all 701 stored `v1` files unchanged. See the
[delivery run record](DELIVERY-RUN.md) for assignments and PRs, and
[the acceptance record](10-drive-acceptance.md) for actual links, receipts, and disclosed limitations.
The reusable-storage delivery below extends that flow to portable walkthrough entry points and
Recon as a second consumer. The original acceptance evidence remains unchanged.

## Reusable workflow storage

The [adapter contract](../design/06-workflow-adapters.md) keeps one store configuration, the existing
package operations, and ordinary plugin input/output files. Separate implementation tasks own the
consumers; the orchestrator owns the contract, integration, documentation, and acceptance.
The [delivery run record](REUSABLE-STORAGE-RUN.md) records task assignments and review decisions.

| Step | Work | Owner / repository | Depends on | Status |
| --- | --- | --- | --- | --- |
| 13 | [Shared adapter contract and integration guide](13-reusable-storage-contract.md) | Orchestrator / task-packet-store | 10 | done |
| 14 | [Portable packet and walkthrough entry points](14-portable-walkthrough-runner.md) | AC-visual-walkthrough | 13 contract | done |
| 11 | [Recon as a second consumer](11-recon-consumer.md) | recon-plugin | 13 contract | done |
| 15 | [Independent review and both-store acceptance](15-reusable-storage-acceptance.md) | Orchestrator + reviewer | 13, 14, 11 | done |
| 16 | [Repeated filesystem checkpoint correction and patch release](16-readonly-checkpoint-fix.md) | task-packet-store + consumers | Failed live proof in 15 | done |

**Reusable storage delivery is complete.** Both consumers use published `0.1.1` and passed
independently reviewed filesystem/Drive saves. The fresh Jira/LLM filesystem run passed all repeated
checkpoints and final delivery. Both consumers and the repeatable acceptance workflow are merged,
with combined CI green. The first failed `0.1.0` run remains recorded in step 16.

## Required delivery sequence

| Step | Work | Owner / repository | Depends on | Status |
| --- | --- | --- | --- | --- |
| 01 | [CI access and shared configuration](01-google-workspace.md) | Administrator + AC-visual-walkthrough | 03–05 | done |
| 05a | [Result locations and Drive links](05a-result-locations.md) | task-packet-store | 05; 01 for live proof | done |
| 06 | [Publish the consumer release](06-release.md) | task-packet-store + npm maintainer | 01, 05a | done |
| 08 | [Jira → packet on Drive](08-jira-to-drive.md) | AC-visual-walkthrough | 01, 06 | done |
| 09 | [Drive packet → walkthrough → Drive report](09-walkthrough-pr.md) | AC-visual-walkthrough | 08 | done |
| 10 | [Prove both commands and repeat the walkthrough](10-drive-acceptance.md) | AC-visual-walkthrough + Drive | 08, 09 | done |

The release followed result-link support so both workflows consume one pinned package version.
Packet preparation was verified through filesystem storage and the real CI/Drive path. Step 10
records both successful commands and preserved run history; merged code alone was not used as
completion evidence.

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
| 12 | [Retire unused walkthrough storage code](12-cleanup.md) | AC-visual-walkthrough | 10 | pending |

Local-only storage remains a supported choice. Step 14 now owns the complete filesystem invocation;
all package changes must continue to work through both transports.

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
