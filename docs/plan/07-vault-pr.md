---
status: pending
step: 07
title: Optional vault integration
---

# Step 07. Optional vault integration

## Outcome

A vault user can view packet runs already stored by the workflow. The vault is an optional consumer;
it does not own the CI configuration or create the packet required by the Drive flow.

## Owner, dependencies, and inputs

- Owner: the selected `adc-vault` checkout.
- Depends on steps 06 and 10; step 02 supplies personal Drive access when needed.
- Inputs: an explicit store-config path, a selected packet destination in the vault, and an existing
  packet/run in the store.

## Work

1. Configure access to the same store independently of the CI configuration file's physical
   location. Keep credentials outside the vault config.
2. Ignore `10 Tasks/Packets/*/stages/*/runs/` in vault Git. Document the generated run zone.
3. Document fetching a packet into a fresh destination and pulling its runs. If the packet is
   already present, use `pull` to retrieve results without replacing its human notes.
4. Add the optional `Stage Runs.base` projection of `type: stage-run` and its navigation link.
   Keep the existing blueprint schema; a schema extension is a separate follow-up.
5. Run the vault's checks and verify a completed Drive run in Obsidian.

## Done when

The vault shows the stored run, the HTML can be opened, and generated runs remain ignored by Git.
Both CI commands still work without this vault integration.

## Evidence

Pending. Record PR/commit, store config path, packet/run used, vault check results, and the viewing
and Git-ignore checks.

## Handoff and rollback

Revert the integration to remove the optional view. Stored packets and runs remain in the selected
store.
