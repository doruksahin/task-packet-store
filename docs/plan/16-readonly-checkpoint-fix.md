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
- GPT-6 Astra/high task `01a07384-91d7-70c1-bcb0-1b6a78afe150` opened
  [PR 12](https://github.com/doruksahin/task-packet-store/pull/12), head
  `24537c1f9cbdfe6f721f0e055455a48fb9ed353f` on `codex/fs-readonly-checkpoints`.
  Its 201 checks and `pnpm release:check` pass, including real rclone transport checks. The extended
  installed-artifact smoke fails against published `0.1.0` at the original second-checkpoint error
  and passes against the fixed archive. Independent review cleared the exact head, including
  packed-code comparison and an independent real CLI reproduction. [CI 33994127404](https://github.com/doruksahin/task-packet-store/actions/runs/33994127404)
  passed. PR 12 merged as `a00a679d36d4f88105128fd63f248c630778d536`.
- Release Please generated [PR 13](https://github.com/doruksahin/task-packet-store/pull/13),
  `0.1.1` at `02ebf339ede87b2bc568582a42ef5a3ebc7fb3f1`. Only four version/changelog files changed;
  all reviewed implementation files stayed identical. A separate candidate checkout passed 201
  checks, artifact verification, and the installed smoke; its [CI](https://github.com/doruksahin/task-packet-store/actions/runs/33994272125)
  also passed. The release merged as `aa44e549809e8d4aa6115bfd0161d89baf0ae46d`.
- [Publication run 33994380267](https://github.com/doruksahin/task-packet-store/actions/runs/33994380267)
  succeeded through npm trusted publishing. The public `0.1.1` archive has SHA-256
  `7d7682690c9a55a502575e78ad4fb70fccb4e54d4e8a8b033dd4cf3bf8cddc43` and integrity
  `sha512-8WwLZLjf11+4G8sc95QR53L1v9qTHTf1iwXnhxdV5pwEBI+r1r05UXKzb9Q+0OzyFOePucp83Pjga9C7UFmzyw==`.
  [Fresh verification run 33994481396](https://github.com/doruksahin/task-packet-store/actions/runs/33994481396)
  confirmed byte-identical npm/GitHub archives and passed the installed registry-package smoke.
- An offline replay using the actual frozen walkthrough observer failed at `capture-finished`
  with `0.1.0`, then passed initialized → capture-finished → report-authored → final report-rendered
  checkpoints with the fixed code. It preserved source seals and all prior `v1` files after a new
  `v2` save. Its synthetic report proves adapter integration; the fresh live retry is still required.
- AC [PR 97](https://github.com/doruksahin/AC-visual-walkthrough/pull/97) now pins `0.1.1` at
  `a4b652c8e3d9ab3528ac09ae358cc21989e10fbe`. Independent review, 45 focused tests (including the
  committed actual-observer regression), 188 renderer tests, and the complete
  [Linux CI](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33994798189) pass.
- Recon [PR 9](https://github.com/AdCreative-ai/recon-plugin/pull/9) updates its pin and current
  mirrors at `006cefb5970904d779e9d1f11ab18a3e191a1eaa`. Independent review, 11 contract groups,
  real published-package filesystem repeats, generated checks, and the complete commit gate pass.
  Corrected both-store proof and independent evidence review passed. PR 9 merged as
  `700641c21e10182fd964ff4944b936c8a1929d50`, with a tree identical to the reviewed head and the
  required SPEC trailer. Historical `0.1.0` evidence remains unchanged.
- Harness [PR 98](https://github.com/doruksahin/AC-visual-walkthrough/pull/98) pins these consumers
  and package `0.1.1` at `222482ec756c767838d9e0d301c8a635620b14cf`. Independent review and the complete
  [Linux CI 33995076779](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33995076779)
  pass. After both gates cleared, the orchestrator removed and reapplied each acceptance label
  once at that exact head. Fresh [both-store run 33995541137](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33995541137)
  passed both jobs, including two versions per consumer, complete readbacks, and prior-run
  preservation. Human Drive access was verified again; [step 15](15-reusable-storage-acceptance.md#corrected-both-store-result-on-011)
  records the new locations and receipt hashes. [Live filesystem run 33995541009](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33995541009)
  is still running. Replaying the unchanged failed workflow would retain the old package pins.

## Done when

The patch is published and independently verified, both consumers pin it, and reviewed acceptance
proves repeated checkpoints plus complete fresh filesystem execution. A permission workaround in
the walkthrough or a synthetic success receipt does not satisfy this step.
