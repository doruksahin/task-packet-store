---
status: in-progress
step: 16
title: Fix repeated filesystem checkpoints of sealed files
---

# Step 16. Complete live filesystem delivery

## Trigger and outcome

The first fresh filesystem walkthrough, run 33992872261, exposed a published `0.1.0` transport
defect. An initial checkpoint copies sealed `0444` files into the store; a later checkpoint's
`copyFileSync` cannot overwrite those destinations. Fresh-version saves passed because they did
not overwrite an existing file in the same run. Final storage failed correctly instead of reporting
success. The required outcome is successful repeated checkpoints without changing sealed sources.

## Work

1. Reproduce the failure with the published package and a minimal read-only source fixture.
2. Fix filesystem transport replacement safely. Keep old destination bytes if the replacement copy
   fails, clean temporary files, preserve source content/modes, and keep operations backend-neutral.
3. Add regressions for repeated unchanged/changed checkpoints and failure preservation. Run
   `pnpm check` and `pnpm release:check`; obtain independent review and required CI.
4. Merge the focused fix and use Release Please to prepare the next patch release. Review the
   generated candidate, verify its artifact, and publish through the existing trusted-publishing
   workflow. Never replace `0.1.0` or manually edit generated version files.
5. Update exact consumer pins and acceptance provenance to the published patch, with consumer
   checks and independent review. Recon's already-merged adapter receives a narrow pin follow-up.
6. Repeat the affected both-store proof and one fresh Jira/LLM filesystem run. Preserve the failed
   run's evidence and all previous Drive acceptance prefixes. Close steps 14/15 only on final proof.

## Evidence

- Private failed run: [33992872261](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33992872261).
  Initial checkpoint succeeded; the next and failure checkpoints reported `EACCES` for
  `input/capture/capture-selection.json`. No success receipt was emitted.
- The AC implementation task independently reproduced the issue with the exact published CLI:
  source `0444`, first destination `0444`, unchanged second checkpoint fails. No LLM or Drive is
  required to reproduce it.
- A separate GPT-6 Astra/high implementation task owns the transport correction in an isolated
  `codex/fs-readonly-checkpoints` worktree. Root owns release and consumer coordination.

## Done when

The patch is published and independently verified, both consumers pin it, and reviewed acceptance
proves repeated checkpoints plus complete fresh filesystem execution. A permission workaround in
the walkthrough or a synthetic success receipt does not satisfy this step.
