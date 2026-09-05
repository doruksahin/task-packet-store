---
status: pending
step: 11
title: Recon as second consumer
---

# Step 11. Recon as second consumer

## Outcome

Recon stores its discovery dossier in `stages/10-recon/runs/vN/` through the same package.
This follow-up is independent of accepting the two Drive workflow commands.

## Owner, dependencies, and inputs

- Owner: `recon-plugin`.
- Depends on steps 06 and 10.
- Inputs: explicit store configuration, ticket, and the existing rendered dossier directory.

## Work

1. Inspect Recon's current host configuration and delivery rail. Add or use an explicit store-config
   input; a vault path may be configured by an operator but is not a built-in prerequisite.
2. After rendering, reserve the stage run with `begin` and persist its output with `checkpoint`.
   Read destination information from package results and use the shared location interface.
3. Preserve Recon's existing optional-capability behavior when no store is configured. Report
   persistence as successful only after the store operation succeeds.
4. Verify the same integration with an `fs` fixture and with the configured Drive destination.
   Keep Jira delivery behavior outside this storage change.

## Done when

Recon's dossier and run records are in the selected store and its result reports their actual
location. The filesystem case works without Drive credentials or a vault.

## Evidence

Pending. Record PR/commit, config input contract, local and Drive test results, ticket/run,
checkpoint result, and output location.

## Handoff and rollback

Revert the Recon integration if needed; keep previously saved dossiers available.
