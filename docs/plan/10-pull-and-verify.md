---
status: pending
step: 10
title: Pull and verify in Obsidian
---

# Step 10. Pull and verify in Obsidian

## Goal

The CI run from step 09 is visible in the vault without a Git change.

## Depends on

Step 09.

## Steps

```bash
cd /Users/doruk/Desktop/ADCREATIVE/adc-vault
task-packet-store pull --store "$PWD/00 System/Integrations/Packet Store/packet-store.json" \
  --ticket ATT-5387 --into "$PWD/10 Tasks/Packets/ATT-5387"
find "10 Tasks/Packets/ATT-5387/stages/20-ac-walkthrough/runs" -type f | head
git status --porcelain
```

Open Obsidian. Open the `Stage Runs` Base from the Hearth Tasks dashboard. Open the run note and
the HTML report in `delivery/`.

## Done when

`find` lists `run.md`, `snapshot.json`, and the delivery HTML. `git status --porcelain` prints
nothing. The Base shows one row for `ATT-5387`, stage `ac-walkthrough`, version `v1`.

## Evidence

```text
```

## Rollback

Delete the local `runs/` folder. Nothing else changed.
