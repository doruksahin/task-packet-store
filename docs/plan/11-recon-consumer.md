---
status: pending
step: 11
title: Recon as second consumer
---

# Step 11. Recon as second consumer

## Goal

The recon plugin writes its discovery dossier into `stages/10-recon/runs/vN/` through the same CLI.
This proves that the package is not walkthrough-shaped.

## Depends on

Step 06.

## Files in the `recon-plugin` repository

- The READY delivery rail that renders the dossier (`recon-report`). Add two calls after the render
  and before the Jira delivery gate.
- `docs/hosts.md`: document the store file location and the credential variable for the adc-vault
  host.

## Steps

1. Resolve the store file from the host: `<adc-vault>/00 System/Integrations/Packet Store/packet-store.json`.
2. After the dossier renders, run:

   ```bash
   task-packet-store begin --store "$STORE" --ticket "$TICKET" --stage 10-recon \
     --run-key "recon-$RUN_ID" --tool "recon@$RECON_VERSION" --state "$RECON_ROOT/$TICKET/packet-run-state.json"
   task-packet-store checkpoint --state "$RECON_ROOT/$TICKET/packet-run-state.json" \
     --reason dossier-rendered --source "$RECON_ROOT/$TICKET/discovery"
   ```

3. Keep the calls behind the plugin's existing capability detection. When `task-packet-store` is
   not on PATH, print a notice and continue. Recon must not fail because the store is absent.
4. Run recon on a ticket with a packet. Then `pull` in the vault.

## Done when

`10 Tasks/Packets/<TICKET>/stages/10-recon/runs/v1/` contains `run.md`, `snapshot.json`, and
`discovery.md` after `pull`.

## Evidence

```text
```

## Rollback

Revert the recon-plugin change.
