---
status: done
step: 11
title: Recon as second consumer
---

# Step 11. Recon as second consumer

## Outcome

Recon stores its discovery dossier in `stages/10-recon/runs/vN/` through the same package.
This was optional for the first Drive delivery. It is now required to prove the reusable adapter
contract requested on 2026-09-05; the original Drive acceptance remains unchanged.

## Owner, dependencies, and inputs

- Owner: `recon-plugin`.
- Depends on steps 06, 10, and the [shared adapter contract](../design/06-workflow-adapters.md).
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
5. Follow Recon's repository governance, document the literal operator command and result receipt,
   and expose the configuration through the existing host/command conventions. Reuse the published
   package through its CLI if that is the smallest fit for Recon's runtime.

## Done when

Recon's dossier and run records are in the selected store and its result reports their actual
location. The filesystem case works without Drive credentials or a vault.

## Evidence

Implementation task `01a0733f-b928-7db2-a672-d04bfbde2ed3` opened
[Recon PR 8](https://github.com/AdCreative-ai/recon-plugin/pull/8) at
`dd453a9f24536ef2c9d5b6886b5c435f91aa7dfc`, based on `ce98c764cca32a27c7bc57be7439654b08fd44a9`.
The literal entry point is `bash recon/scripts/store-dossier.sh --store <absolute-config>
--ticket PROJ-123 --source <current-ticket-workspace>`.

The adapter stages current-run supporting files, excluding top-level archived `runs/`, and saves
`report/dossier.html` plus evidence through published package `0.1.0`. Its initial eight contract groups,
real filesystem repeat proof, generated-adapter check, and complete local pre-commit rail passed.
No hosted checks are registered on that PR. Independent review reproduced two issues: traversal
errors could omit unreadable current-run evidence, and overlapping filesystem destinations could
modify the source workspace. Corrective head `f6c5e244f50f42e4a262dbafe1502acec545ba96` fixes both,
passes 11 contract groups, repeats the real filesystem proof, and passes the full staged pre-commit
rail. Independent review repeated both failure reproductions and cleared this exact head.
The [both-store acceptance](15-reusable-storage-acceptance.md#both-store-result) passed and received
independent evidence review. PR 8 merged to `master` as `d2189c35d2df2a8341b0136531312df9b26bca80`.
The source-checkout command is delivered; this is not a plugin publication or activation claim.

The final consumer pins published storage `0.1.1` through
[PR 9](https://github.com/AdCreative-ai/recon-plugin/pull/9), reviewed at
`006cefb5970904d779e9d1f11ab18a3e191a1eaa`. All 11 contract groups, the complete local commit gate,
and [corrected both-store acceptance](15-reusable-storage-acceptance.md#corrected-both-store-result-on-011)
passed. Independent evidence review verified all files and records, both versions, and preservation.
The human Drive account retrieved the new dossier and supporting run folder. PR 9 merged as
`700641c21e10182fd964ff4944b936c8a1929d50`; its tree exactly matches the reviewed commit and its
commit retains `Implements: SPEC-01M1SMA0CR7BCGE0821Z46YWYW`.

## Handoff and rollback

Revert the Recon integration if needed; keep previously saved dossiers available.
