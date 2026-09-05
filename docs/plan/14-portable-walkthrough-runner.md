---
status: in-progress
step: 14
title: Portable Jira and walkthrough runner
---

# Step 14. Run packet creation and walkthrough with either store

## Outcome

The walkthrough repository exposes documented commands for Jira → packet and packet → walkthrough
that accept an explicit store config. The same processing/delivery implementation supports `fs`
and `gdrive`. Existing Drive Actions entry points remain usable.

## Owner and inputs

Owner: AC-visual-walkthrough implementation task. Depends on the step 13 contract and existing
steps 08–10. Inputs: store config, ticket, explicit workspace, current runner credentials and target.

## Work

1. Extract the smallest portable entry points from the existing Jira preparation and walkthrough
   wrappers. Document actual commands and prerequisites; reuse pinned tools and packet templates.
2. Replace Drive-only result validation and hard-coded output paths with package-returned locations.
   Keep packet identity, final-save requirements, run versioning, and draft semantics intact.
3. Make GitHub Actions invoke the portable code with the existing shared Drive config. Do not claim
   that a hosted runner's temporary filesystem can persist between independent jobs.
4. Test a fresh filesystem store without Google credentials/rclone, repeat-run preservation, saved
   result validation, and failures. Prepare a repeatable Drive smoke through the same code.
5. Follow the consumer's CI and release/renderer comparison rules where applicable. Open a reviewable
   PR and provide commands, receipts, exact commits, and any remaining live acceptance needs.

## Done when

Both entry points run with either store configuration, the old Drive workflow commands still work,
and the operator receives a path or URL for the saved packet/report. Filesystem and Drive proof
must distinguish deterministic storage checks from actual LLM/capture execution.

## Evidence

Implementation delegated; exact assignment and results will be recorded by the orchestrator.
