# Reusable workflow storage delivery — 2026-09-05

Orchestrator: `01a070c2-5df2-7711-bf96-a2493e76ab7b`.
The user requested a plan and delegated implementation of shared filesystem/Google Drive selection
for additional LLM workflows/plugins. The [plan board](README.md#active-delivery-reusable-workflow-storage)
tracks completion; the original Drive delivery evidence remains unchanged.

## Assignments

| Work | Task | Model | Ownership |
| --- | --- | --- | --- |
| Contract, integration, docs | Orchestrator above | Current task | Shared contract, acceptance coordination, final documentation |
| Portable packet and walkthrough runner | `01a0733f-5e0c-7003-8d05-980376578103` | GPT-6 Astra, high | AC-visual-walkthrough consumer commands and wrappers |
| Recon dossier delivery | `01a0733f-b928-7db2-a672-d04bfbde2ed3` | GPT-5.6 Sol, high | Recon adapter and repository governance |
| Independent review | `01a07340-08c0-7de0-a709-79e931140a7b` | GPT-6 Astra, high | Read-only contract and exact-commit consumer review |
| Both-store acceptance | `01a07344-768d-73e2-8f5d-209ea2a066e5` | GPT-5.6 Sol, high | Isolated acceptance harness in the private walkthrough repository |
| Filesystem checkpoint correction | `01a07384-91d7-70c1-bcb0-1b6a78afe150` | GPT-6 Astra, high | Focused package fix, regressions, and installed-artifact verification |

Implementers use separate worktrees and open reviewed PRs. The orchestrator coordinates merges
and live proof. Remote acceptance uses an isolated prefix; existing packet/run evidence is preserved.
Recon's public source repository must not receive Drive credentials or private task fixtures.

## Contract checkpoint

- Plan and adapter contract committed at `ed0be0d82d1f20998df633b12539a4e63ce6deba`.
- `pnpm check`: 190 tests passed with no skips before the planning checkpoint.
- Independent review found no blocking contract defect or missing published store operation.
  Published `@doruksahin/task-packet-store@0.1.0` supplied the required operations. The later live
  filesystem run exposed a transport defect requiring the patch tracked in step 16; no new API is needed.
- Consumer boundaries: preserve walkthrough runtime validation and draft semantics; support both
  location types; reserve fresh versions independently of internal runtime filenames.
- Recon's source is the current ticket workspace root, including `report/dossier.html` and its
  supporting evidence. Its adapter excludes top-level archived `runs/` and keeps store state outside
  the workspace. Saving `report/` alone would omit supporting session evidence.
- Recon's Decree specification skill required a human reference selection. The user selected the
  accepted `ADR-01KZ0ZK4WYVWRY0WJM2CZ7ZS8C` (Portable Multi-Harness Recon Plugin Architecture), with
  no PRD reference and no extension of an earlier SPEC. The implementation task has that selection.

## Implementation and acceptance

Documentation [PR 11](https://github.com/doruksahin/task-packet-store/pull/11) passed independent
review at `c2a43ed23b5e1dc33402d90cf1e9de4205dd345b` and the required Node 20 CI. A wording correction
clarifies that a new `begin` reserves the next version; checkpoints update the reserved run.

The initial reviewed consumers passed both-store saves in run `33992872489`. Recon
[PR 8](https://github.com/AdCreative-ai/recon-plugin/pull/8) merged as
`d2189c35d2df2a8341b0136531312df9b26bca80`. The fresh Jira/LLM filesystem run `33992872261` then
exposed a repeated-checkpoint defect. [Step 16](16-readonly-checkpoint-fix.md) records its focused
fix, independent reproduction, and the published and independently verified `0.1.1` patch.

The corrected final references are independently reviewed:

| Change | PR | Reviewed commit | Verification |
| --- | --- | --- | --- |
| Portable walkthrough, exact `0.1.1` pin | [AC 97](https://github.com/doruksahin/AC-visual-walkthrough/pull/97) | `a4b652c8e3d9ab3528ac09ae358cc21989e10fbe` | Full Linux CI `33994798189` |
| Recon exact `0.1.1` pin | [Recon 9](https://github.com/AdCreative-ai/recon-plugin/pull/9) | `006cefb5970904d779e9d1f11ab18a3e191a1eaa` | Full local commit gate and real filesystem repeats |
| Acceptance pins and fixture provenance | [AC 98](https://github.com/doruksahin/AC-visual-walkthrough/pull/98) | `222482ec756c767838d9e0d301c8a635620b14cf` | Full Linux CI `33995076779` |

The orchestrator started fresh both-store run `33995541137` and real Jira/LLM filesystem run
`33995541009` only after these gates passed. The acceptance task owns execution and receipts;
the reviewer independently checks evidence. The both-store run passed, all eight deliveries passed
independent evidence review, and human Drive retrieval was verified. Recon PR 9 merged as
`700641c21e10182fd964ff4944b936c8a1929d50`, with a tree identical to its reviewed head.
Final walkthrough integration awaits the fresh live result. Existing rendered-bundle storage proof
remains distinct from new live Jira/LLM execution.
