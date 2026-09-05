---
status: pending
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

Pending steps 13, 14, and the now-required second-consumer step 11.
