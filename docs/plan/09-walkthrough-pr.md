---
status: pending
step: 09
title: Drive packet to walkthrough to Drive report
---

# Step 09. Drive packet → walkthrough → Drive report

## Outcome

The second command in [the operator contract](00-required-operator-flow.md) consumes the stored
packet and saves the draft HTML, evidence, and run records on Drive with working result links.

## Owner, dependencies, and inputs

- Owner: `doruksahin/AC-visual-walkthrough`.
- Depends on step 08, including its shared CI config, pinned tools, and valid Drive packet.
- Inputs: ticket and the existing lab target/credentials. Keep the lab's draft-report behavior.

## Deliverables

| File or area | Change |
| --- | --- |
| `.github/workflows/walkthrough-lab.yml` | Drive input, run reservation, checkpoints, final result links |
| `.github/walkthrough-agent-prompt.md` | Local temporary runtime output; wrapper persists it to the selected store |
| `run-history.ts` and digest contract test | Delegate packet identity to the shared package |
| Packaged runtime, consumer docs, and relevant ADRs | Rebuild as required and describe the new storage path |

## Work

1. Replace the R2 fetch step with `task-packet-store fetch` using the same config as step 08.
   Capture its receipt and digest. This command consumes the existing Drive packet; it does not
   export or refresh Jira.
2. Reserve `20-ac-walkthrough` with `begin`, passing the fetched digest and a unique workflow run
   key. Retain the resulting state and reservation receipt.
3. Run the existing walkthrough against the fetched packet with local temporary output. Read the
   source directory and rendered HTML path from validated runtime results; use the store's
   reservation for the destination rather than guessing it from local directory names.
4. Connect the existing phase observer to `checkpoint`. Keep failure-boundary evidence when
   possible. A successful final result requires a successful render, an existing HTML file, and a
   successful final checkpoint of the complete output directory.
5. Resolve the saved run-folder and actual HTML links through step 05a. Write `report-saved` only
   after the required files and records have been stored and the links resolved. Missing runtime
   state/output or a failed final upload must leave the workflow failed, with diagnostics.
6. Make the walkthrough's `packetSha256` delegate to the shared package's identity implementation.
   Preserve the cross-package digest test, rebuild packaged runtime as the consumer requires,
   and run its checks.
7. Exercise the workflow against step 08's packet. Update current user docs and the relevant
   architecture records. Keep unrelated storage consumers and historical output for later cleanup.

## Done when

- A fresh runner reads the Drive packet and records the same input digest as step 08.
- The selected run folder on Drive contains HTML, evidence, `run.md`, and `snapshot.json`.
- The summary has usable report and run links, not runner filesystem paths.
- The workflow's success requires both rendering and persistence; diagnostics cannot substitute
  for a saved report.
- The consumer's checks and digest contract test pass.

## Evidence

Pending. Record:

- PR/commit, runtime/package versions, and check results.
- User command, exact Actions run URL, fetched digest, and reservation receipt.
- Final checkpoint result and actual HTML relative path.
- Drive report/run links and verification that they address the saved output.

## Handoff and rollback

Pass the successful command/result evidence to step 10. Revert the integration if needed while
preserving generated runs. Cleanup of unused R2/Git storage code is step 12.
