---
status: done
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

- [PR 93](https://github.com/doruksahin/AC-visual-walkthrough/pull/93) merged at
  `08307480cce07cfcab32d94df1359d1055f5d9d5`. Independent review cleared the final published-package
  build and the merge delta at `a453c51a48969902f046d95b9d4cc53b59fa5d97`.
  [CI 33962493465](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33962493465)
  passed the full tests, documentation, and registry-conformance checks.
- Fresh root/runtime/legacy installs resolve published store `0.1.0`; the regenerated runtime
  uses its lightweight identity entry point. Twenty-two delivery/digest tests and 188 renderer
  tests passed. Both showcase HTML files and representative viewport captures match released
  walkthrough `6.5.0`; the comparison is recorded in the consumer repository.
- The wrapper preserves draft semantics, strips Drive credentials from the Claude child, and
  requires validated render receipts, complete output, successful final checkpoint, and actual
  Drive links before reporting `report-saved`.
- The exact user command with `-f ticket=ATT-5387` started
  [Actions run 33962860607](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33962860607),
  which succeeded in 13m15s. Reservation: stage `20-ac-walkthrough`, version `v1`, run key
  `github-33962860607-1`. Its independent runner fetched the producer digest
  `2502dacdd4f4f70a13a4b8416d84cc70dd3e7bf5d398b223e9532558285f7653`.
- The initialized, capture-finished, report-authored, and final report-rendered checkpoints passed.
  Final snapshot inventory SHA-256:
  `dffc612dda5d513acfb58a67ca802c9934ef7d49d5b48ed8236fdc17f1775b75`.
  Capture succeeded; renderer spec `2.9` exited zero with no errors or warnings.
- The actual [report](https://drive.google.com/file/d/1cX-sJugWQhZaeUE8KKShPybuC-W4JIcN/view)
  lives at `packets/ATT-5387/stages/20-ac-walkthrough/runs/v1/delivery/ATT-5387-ac-verification-v1.html`.
  The [run folder](https://drive.google.com/drive/folders/1ZarF3q5Bay8deEzayJHdfIxHH7UqSAQb)
  contains its inputs, evidence, trace, `run.md`, and `snapshot.json`.
- The operator's Drive connector retrieved the HTML: 985,530 bytes, SHA-256
  `274d73754a8bf15e31d38186339d01ec7ec71f073c8fc4d54889e6a75f86f442`, matching both the
  renderer receipt and independent stored-file verification. The exact file renders visibly in
  isolated Chrome in light and dark modes without JavaScript errors. Native Chrome exposed the
  complete report through accessibility, although its window screenshot was blank; the same
  symptom did not reproduce in the isolated browser.
- The draft marks all nine ACs as `Needs evidence`: the mock target could not advance past avatar
  selection. Storage success is not an AC-pass claim. The embedded trace shortcut retains the
  existing renderer's runner-local `file://` contract; the actual
  [saved trace](https://drive.google.com/file/d/1EkcuRqXvtjimEmFlCm6yv0n5sTiKtXXM/view)
  is available from the run folder at `input/capture/trace.zip`. Portable trace shortcuts are a
  follow-up; the saved HTML and embedded screenshot evidence work independently of that shortcut.

## Handoff and rollback

Pass the successful command/result evidence to step 10. Revert the integration if needed while
preserving generated runs. Cleanup of unused R2/Git storage code is step 12.
