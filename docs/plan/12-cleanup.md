---
status: pending
step: 12
title: Retire unused walkthrough storage code
---

# Step 12. Retire unused walkthrough storage code

## Outcome

Current walkthrough documentation and execution use the new packet store. Unused legacy storage
code can be removed after the Drive flow has passed acceptance.

## Owner, dependencies, and inputs

- Owner: `AC-visual-walkthrough`.
- Depends on step 10.
- Inputs: acceptance evidence and an inventory of remaining consumers of the R2/Git storage paths.

## Work

1. Search current workflows, runtime code, scripts, and docs for old packet-store entry points and
   credential names. Identify every remaining consumer before removing shared code.
2. Remove the superseded `packages/packet-store/` and its scripts/dependencies only when no active
   consumer needs it. Retire other storage code only after its consumers have migrated.
3. Update current documentation and keep superseded architecture records as history.
4. Remove repository secrets only after the inventory establishes that no workflow uses them.
   Historical artifact migration and deletion of external stores are outside this code cleanup.
5. Run consumer checks and one successful walkthrough using the new store.

## Done when

Current entry points use the new store, repository checks pass, and a new walkthrough still saves
its report on Drive. Historical reports remain available.

## Evidence

Pending. Record PR/commit, consumer inventory, removed code/secret names, check results, and the
successful Actions run/report link.

## Handoff and rollback

Revert the code change if necessary. Keep the previous configuration recoverable until the new
workflow check passes; this step does not remove historical external artifacts.
