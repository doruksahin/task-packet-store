---
status: in-progress
step: 15
title: Verify two workflows with both stores
---

# Step 15. Verify reusable storage end to end

## Outcome

AC-walkthrough and Recon use the same storage selection and report usable saved locations with
both filesystem and Google Shared Drive storage. This is a new delivery; steps 01–10 remain the
historical proof of the original Drive flow.

## Work

1. Independently review the shared contract and both consumer PRs at fixed commits. Resolve issues
   and complete each repository's required checks before integrating changes.
2. Execute the portable packet creation and walkthrough path against a persistent filesystem
   directory, without Google credentials. Verify packet/report bytes and returned locations.
3. Run the same code against an isolated prefix in the existing Shared Drive. Preserve the existing
   packet and its accepted storage evidence. Verify remote locations and retrieved output.
4. Deliver an actual Recon-rendered dossier using its new adapter to each store. Verify dossier,
   evidence, and run records. Keep any existing publication/approval requirements intact.
5. Repeat output delivery to verify next-version allocation and unchanged earlier files. Include a
   save failure check so successful processing cannot falsely report successful persistence.
6. Record exact versions, commits, commands, outcome receipts, real paths/URLs, and limitations.
   Update the operator playbook and a new-plugin integration guide around the shipped commands.

## Done when

Both consumers pass both storage cases, portable operator commands are documented, earlier runs
are preserved, and independent review clears the final code. A fixture proves storage behavior;
it is not evidence of a newly completed live Jira/LLM workflow. Any missing live proof stays explicit.

## Evidence

The acceptance task has exercised both candidate adapters through real filesystem storage:
fresh `v1`/`v2`, primary/supporting file readback, package records, snapshot rehashing, complete
packet verification, and unchanged earlier run trees. These are preliminary deterministic checks;
final evidence must use the corrected independently reviewed consumer heads.

The private walkthrough repository harness is being prepared with two deliberate triggers:
`reusable-storage-drive` for filesystem/Drive adapter proof and `reusable-storage-live-fs` for a
new real Jira/LLM filesystem run. Secret-bearing jobs require an explicit same-repository labeled
event (or later manual dispatch); an existing label must not trigger new writes on every push.
The original private AC draft bundle and a synthetic skill-rendered Recon fixture are separately
identified as acceptance inputs. No new remote or paid execution has started.

The harness is [PR 98](https://github.com/doruksahin/AC-visual-walkthrough/pull/98), initially
`170bcd248195ceb2c54d61076c47b3bbc5b6dc07`. Independent review found and confirmed three fixes at
`420e546b2a4c904ab114bb719e4286ec9322073f`: valid step-level runner paths, installation of consumer
runtime dependencies, and snapshot manifests sorted with the package's UTF-8 byte ordering.
The package includes hidden files and ignores only `.DS_Store`; full stored-byte preservation is
checked separately. The corrected harness passed actionlint, local filesystem acceptance, and
the complete [Linux CI](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33992263960).

Final candidate `46496a6832c868342ee234794787299022e31300` updates only the Recon reference and fixture
provenance to `f6c5e244f50f42e4a262dbafe1502acec545ba96`. Both adapters passed filesystem acceptance
at those exact refs. Independent review cleared both the Recon correction and final harness reference
delta. Remote acceptance waits for the final harness CI check before the two labels are applied.
