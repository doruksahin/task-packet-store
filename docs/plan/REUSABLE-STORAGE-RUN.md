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

Implementers use separate worktrees and open reviewed PRs. The orchestrator coordinates merges
and live proof. Remote acceptance uses an isolated prefix; existing packet/run evidence is preserved.
Recon's public source repository must not receive Drive credentials or private task fixtures.

## Contract checkpoint

- Plan and adapter contract committed at `ed0be0d82d1f20998df633b12539a4e63ce6deba`.
- `pnpm check`: 190 tests passed with no skips before the planning checkpoint.
- Independent review found no blocking contract defect or missing published store operation.
  Published `@doruksahin/task-packet-store@0.1.0` is sufficient; no package release is planned.
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

Walkthrough [PR 97](https://github.com/doruksahin/AC-visual-walkthrough/pull/97) is under corrective
review. Step 14 records the concrete findings. Recon and acceptance harness implementation are
still in progress. Record exact PR/commit references and evidence in steps 11, 14, and 15 as work completes.
Deterministic storage proof and existing rendered bundles must be labeled separately from new
live Jira/LLM execution. Merged code alone does not complete acceptance.
