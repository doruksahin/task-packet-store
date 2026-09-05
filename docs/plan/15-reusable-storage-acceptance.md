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

The private walkthrough repository harness has two deliberate triggers:
`reusable-storage-drive` for filesystem/Drive adapter proof and `reusable-storage-live-fs` for a
new real Jira/LLM filesystem run. Secret-bearing jobs require an explicit same-repository labeled
event (or later manual dispatch); an existing label must not trigger new writes on every push.
The original private AC draft bundle and a synthetic skill-rendered Recon fixture are separately
identified as acceptance inputs. Both labels were applied once after independent review and green
CI on the final harness commit; no label-triggered write occurs on subsequent pushes.

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
delta. The final head passed [CI 33992595671](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33992595671).

### Both-store result

[Run 33992872489](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33992872489)
passed both filesystem and Shared Drive jobs at harness `46496a6832c868342ee234794787299022e31300`.
Both jobs used AC `6956b53111c81092c38738f7955b73560646c58a`, Recon
`f6c5e244f50f42e4a262dbafe1502acec545ba96`, and published storage package `0.1.0`.
Drive writes were confined to `acceptance/reusable-storage/33992872489-1` in the existing Shared Drive.
The canonical `packets/` destination was not used by this acceptance run.

| Consumer | Input | Each saved run | Drive primary results |
| --- | --- | --- | --- |
| AC-walkthrough | Existing real draft from run 33964047130; no new LLM judgment | 15 payload files + `run.md` + `snapshot.json`; HTML 1,980,288 bytes | [v1 HTML](https://drive.google.com/file/d/14TbQg7pzhQigt7NyjnkFZFXJrPK7ZVib/view), [v2 HTML](https://drive.google.com/file/d/1qsLIM_RGKw69BCAdhC0VLx2fzJpLtq4N/view) |
| Recon | Synthetic, skill-rendered `PROJ-123` current workspace | 4 payload files + `run.md` + `snapshot.json`; HTML 17,893 bytes; archive excluded | [v1 dossier](https://drive.google.com/file/d/1SvCeHGKM4kugluGb0HdPVWl_j08QYjif/view), [v2 dossier](https://drive.google.com/file/d/1U4ErCt_drKjx6D47L4nKLsAxLzEbTvrL/view) |

All four AC HTML copies (two stores × two versions) have SHA-256
`d0ed22225affb5621f55348e015c314f7f8bd7b7abcd9f0e4d93dcc4742504ea`.
All four Recon HTML copies have SHA-256
`09620ae18febff0dd3eb29bbeef336cfeb4f74fa37451b92d4df870dd6999f96`.
Fresh fetch/pull readbacks verified packet files, every saved payload file, both package records,
and snapshot inventories. Re-pulling `v1` after `v2` preserved all 17 AC files and all 6 Recon files.
Both source workspaces remained unchanged. Filesystem failure probes rejected checkpoint and
location failures without emitting a success receipt or summary; the consumer suites additionally
cover their validation and preservation failures.

The connected human Drive account retrieved both kinds of HTML and listed both `v1` run folders:
[AC run](https://drive.google.com/drive/folders/11egsJqcObLlhX2olTnIBPsrbBvOucB8r),
[Recon run](https://drive.google.com/drive/folders/1wud7ojTWEqoooUEc2dJxUL1PyjPbpAUv).
Metadata for all four primary links matched the expected names and sizes. Byte equality comes from
the runner's complete readback; Drive links store downloadable HTML rather than hosted websites.

Exact command arrays, locations, hashes, and preservation receipts are retained in the private run's
`reusable-storage-fs-33992872489-1` and `reusable-storage-gdrive-33992872489-1` artifacts, under
`acceptance-fs/acceptance-result.json` and `acceptance-gdrive/acceptance-result.json` respectively.
The Drive receipt's SHA-256 is `3f535f0de33f1186ab523f8ef3421791f58621637bc0518104ccac3ae989f906`.

### Fresh Jira and LLM filesystem run

[Run 33992872261](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33992872261)
exported the real Jira ticket and ran a new walkthrough with the portable commands and an `fs`
config, but final delivery failed: repeated checkpoints could not overwrite read-only capture files
copied by the initial checkpoint. It emitted no successful delivery receipt. The focused package
correction, release, consumer updates, and fresh retry are tracked in
[step 16](16-readonly-checkpoint-fix.md). This job used no Drive storage credentials or rclone;
its partial filesystem and diagnostics are retained as a private artifact, not claimed as durable
storage across independent hosted jobs or as successful final delivery.

### Corrected both-store result on `0.1.1`

[Run 33995541137](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33995541137)
passed both stores at reviewed harness `222482ec756c767838d9e0d301c8a635620b14cf`, using AC
`a4b652c8e3d9ab3528ac09ae358cc21989e10fbe`, Recon `006cefb5970904d779e9d1f11ab18a3e191a1eaa`,
and published storage `0.1.1`. The new Drive prefix is
`acceptance/reusable-storage/33995541137-1`; previous acceptance and canonical packets are preserved.

| Consumer | Payload per version | Corrected Drive results |
| --- | --- | --- |
| AC-walkthrough | Same existing real draft, 15 files; HTML 1,980,288 bytes | [v1 HTML](https://drive.google.com/file/d/19RaV_fTc4wSWRkbbvau59QUwZxR16EeO/view), [v2 HTML](https://drive.google.com/file/d/1EIaISDPiV9_3kOIpOAQRv3qxdDy3tUwW/view), [v1 run](https://drive.google.com/drive/folders/1BPTtRBr8Qe5c6pmqfsaG6C-yc-iLoVh1) |
| Recon | Skill-rendered fixture with corrected provenance, 4 files; HTML 17,893 bytes | [v1 dossier](https://drive.google.com/file/d/1_Q7Eb-2QvekaIksMlHgRRxrqCbMcLVW-/view), [v2 dossier](https://drive.google.com/file/d/1Gej0EvkKnjub50Hu7OzLYC6m67HLlLzR/view), [v1 run](https://drive.google.com/drive/folders/1v3wHE-6FMFM-0hBMrIpDasUwdIfsx5AZ) |

All four AC copies retain SHA-256 `d0ed22225affb5621f55348e015c314f7f8bd7b7abcd9f0e4d93dcc4742504ea`.
All four corrected Recon copies have SHA-256
`77842f27909551006423412b740c9639a2c92378b3a0424cbe54a2f3a843a1a5`.
The nine packet files, every payload file, `run.md`, and `snapshot.json` passed readback and inventory
checks. Repeating delivery preserved every earlier AC file (17 including records) and Recon file
(6 including records), and the source trees remained unchanged. Filesystem checkpoint/location
failure probes emitted no success result or summary. Drive failure probes were explicitly skipped.

The connected human Drive account fetched both kinds of `v1` HTML and listed both run folders.
All four primary metadata responses matched their expected names and sizes. These links hold
downloadable HTML; they are not hosted report websites.

Private artifacts `reusable-storage-fs-33995541137-1` and `reusable-storage-gdrive-33995541137-1`
retain exact commands, receipts, and complete readbacks. Their `acceptance-<driver>/acceptance-result.json`
hashes are `6e8c93b5817a6ef1cc595123cc805716b5795dbc7c603719673b8035f9a3ef25` (filesystem) and
`4b1ccd961d9c2aecd84536f89c99e00d854997432d5f301905e7c5669411eaca` (Drive).
Independent evidence review rehashed all eight deliveries and their raw receipts, all packet and
snapshot inventories, and every earlier-run preservation copy, with no findings. This remains
existing-output storage proof. The fresh live result follows.

### Successful fresh Jira and LLM filesystem execution

[Run 33995541009](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33995541009)
succeeded in 11 minutes 20 seconds at the same reviewed harness and AC commits with storage `0.1.1`.
It exported Jira anew, prepared and verified the packet, started the configured `v2-mock` app,
and invoked the real walkthrough through the portable filesystem command. This job used no Drive
storage credentials or rclone installation step.

- The producer returned `packet-ready` with packet SHA-256
  `2502dacdd4f4f70a13a4b8416d84cc70dd3e7bf5d398b223e9532558285f7653`.
- Checkpoints advanced through initialized, capture-finished, and report-authored; the final
  snapshot and runner state agree on `report-rendered` at `2026-09-05T22:29:57.054Z`.
  The complete 16-file payload has inventory SHA-256
  `04b4d7e61bbd8d3b2ab1923c826c0f8248565352df15bad13e3956decd2c3618`.
- Delivery returned `report-saved`, `label: draft`, `version: v1`, and actual filesystem locations.
  Its receipt SHA-256 is `0d1f70d0e54d810a406e4cbd23d5bea334837794c0bc6fe505225f880e790c91`.
- Source, staged, and stored HTML match: 1,326,042 bytes, SHA-256
  `ba1bd5c904bcd7f706739ddfed4c75259c4a2a06874395f57c26887158228446`. The render receipt reports
  exit 0, zero errors, and zero warnings. Three screenshots and the capture trace are retained.
- The new LLM invocation succeeded in 61 turns. All nine AC verdicts remain `needs-evidence`:
  the mock's avatar-selection step prevented reaching Script. Storage completion is not an AC pass
  or human approval.

The private `reusable-storage-live-fs-33995541009-1` artifact retains the Jira receipts, full
processing workspace, and filesystem store. The saved report is at
`live-fs-persistent/ATT-5387/stages/20-ac-walkthrough/runs/v1/delivery/ATT-5387-ac-verification-v1.html`
under the artifact's `AC-visual-walkthrough/AC-visual-walkthrough/` directory. Runner-local paths
are evidence of the configured job filesystem; the artifact provides retention after that hosted
job ends. A production filesystem deployment must use a persistent host or mounted volume.
The original failed `0.1.0` run and every earlier Drive prefix remain unchanged.

Independent evidence review cleared this exact run with no findings: Jira identity and all nine
packet files, new LLM invocation, all four checkpoint inventories, the complete final payload and
records, source/staged/stored HTML and Markdown, three screenshot hashes, transcript, and valid
trace archive. The final store contains 18 files including `run.md` and `snapshot.json`, with no
omitted or unlisted payload and no observer error. Walkthrough PR 97 then merged at the reviewed tree.
