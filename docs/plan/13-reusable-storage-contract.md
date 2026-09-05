---
status: in-progress
step: 13
title: Shared workflow adapter contract
---

# Step 13. Reuse storage selection across workflows

## Outcome

Another packet-based workflow can reuse one `--store` config and the published package without
implementing filesystem/Drive storage itself. The operator can see the input/output contract and
copy real commands from a concise integration guide.

## Work and ownership

The orchestrator owns [the adapter contract](../design/06-workflow-adapters.md), coordinates both
consumers, keeps the playbook current, and records independent review and acceptance evidence.
The package's existing CLI and transport contract remains authoritative. A package change/release
is required only if actual integrations expose a missing capability.

## Done when

- Both consumers agree on explicit store selection, ordinary working files, and saved result locations.
- One documented adapter sequence works with the existing published package.
- The integration guide contains real commands, expected inputs/outputs, and execution-host requirements.
- Independent review confirms that storage policy is not duplicated inside plugins.

## Evidence

Contract recorded before implementation at `ed0be0d`. The
[integration guide](../integrating-a-workflow.md) describes the shared inputs and storage sequence.
Consumer implementation and independent review pending.
