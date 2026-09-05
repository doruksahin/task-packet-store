---
status: done
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

Implementation task `01a0733f-5e0c-7003-8d05-980376578103` opened
[PR 97](https://github.com/doruksahin/AC-visual-walkthrough/pull/97) at
`494b76d6b18f26174ca48181f5577e36eac2cd61`, based on the previous Drive delivery.
Focused filesystem tests and renderer comparison pass. Independent review found three regressions:
failure recovery could checkpoint pre-existing workspaces, packet verification omitted non-identity
files, and Actions summaries dropped saved-path fields. All three were fixed and independently
reproduced as resolved at `6956b53111c81092c38738f7955b73560646c58a`.

That initial corrected head passed 44 targeted tests with no skips and the complete
[Linux CI run 33991259282](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33991259282),
including the installed-capture smoke. The HTML and eight viewport comparison pairs match released
walkthrough `6.5.0` byte for byte. The initial both-store proof passed, then fresh live filesystem
execution exposed the repeated-checkpoint defect recorded in [step 16](16-readonly-checkpoint-fix.md).

Final reviewed head `a4b652c8e3d9ab3528ac09ae358cc21989e10fbe` pins published storage `0.1.1`
and adds the actual-observer regression through all checkpoint phases. Its 45 focused tests,
188 renderer tests, and complete [Linux CI 33994798189](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33994798189)
pass. [Corrected acceptance](15-reusable-storage-acceptance.md) passed both-store saves in run
`33995541137` and a fresh real Jira/LLM filesystem run in `33995541009`. Independent evidence review
verified the final report, every stored file, packet identity, and all four checkpoint phases.
PR 97 merged as `3848abb340ebf58f9034376c70e0fe3b0859b4f7`; its tree exactly matches the reviewed
head. The source-checkout commands and existing Drive Actions wrappers are delivered.
