---
status: pending
step: 07
title: Vault PR
---

# Step 07. Vault PR

## Goal

The vault ignores stage runs in Git, owns the credential-free store config, documents `push` and
`pull`, and projects runs in a Base.

## Depends on

Step 01 for the `sharedDriveId`. Independent of the package code.

## Files in `/Users/doruk/Desktop/ADCREATIVE/adc-vault`

| File | Change |
| --- | --- |
| `.gitignore` | Add the line `10 Tasks/Packets/*/stages/*/runs/` |
| `00 System/Integrations/Packet Store/packet-store.json` | Create. The `gdrive` config below |
| `00 System/Integrations/Packet Store/README.md` | Create. Operator guide below |
| `00 System/Integrations/Packet Store/Stage Runs.base` | Create. Projection below |
| `00 System/Work OS/Task Packet Blueprint/stages/AGENTS.md` | Add one bullet: "`runs/` directly below a stage is a generated zone owned by task-packet-store. Never place templates there." |
| `AGENTS.md` | Add one item to "Before working on an ATT issue": "Tool output lives under `stages/NN-slug/runs/vN/`. It is git-ignored and arrives with `task-packet-store pull`. Never commit it and never edit it." |
| Hearth Tasks dashboard note | Add a link to `Stage Runs.base`, as the vault `AGENTS.md` requires for support views |

Do not touch `blueprint.md`. It is a closed schema that Work OS parses fail-closed.

## Content

`packet-store.json`:

```json
{
  "driver": "gdrive",
  "sharedDriveId": "<from step 01>",
  "prefix": "packets",
  "identity": ["00 Packet.md", "task.md", "jira/**"]
}
```

`README.md`:

```markdown
---
type: guide
scope: packet-store
---

# Packet store

Tool output for a task lives under `10 Tasks/Packets/<KEY>/stages/NN-slug/runs/vN/`. Git ignores it.
The Google Shared Drive `ADC Task Packets` stores it. The `task-packet-store` CLI moves it.

## Prerequisites

1. Install rclone: `brew install rclone`.
2. Create a token once: `rclone authorize "drive"`. Export the JSON as `PACKET_STORE_DRIVE_TOKEN`.
3. Install the CLI: `npm install --global @doruksahin/task-packet-store@<pinned version>`.

## Commands

Run these from the vault root. Replace `ATT-123`.

Upload a packet before a CI run:

```sh
task-packet-store push --store "$PWD/00 System/Integrations/Packet Store/packet-store.json" \
  --ticket ATT-123 --from "$PWD/10 Tasks/Packets/ATT-123"
```

Download tool output after a CI run:

```sh
task-packet-store pull --store "$PWD/00 System/Integrations/Packet Store/packet-store.json" \
  --ticket ATT-123 --into "$PWD/10 Tasks/Packets/ATT-123"
```

Runs appear in Obsidian under the stage folder and in the Stage Runs view. `git status` stays clean.
```

`Stage Runs.base`:

```yaml
filters:
  and:
    - file.ext == "md"
    - type == "stage-run"
properties:
  jira_key:
    displayName: Task
  stage_id:
    displayName: Stage
  version:
    displayName: Version
  tool:
    displayName: Tool
  started_at:
    displayName: Started
views:
  - type: table
    name: Stage runs
    order:
      - jira_key
      - stage_id
      - version
      - tool
      - started_at
    sort:
      - property: started_at
        direction: DESC
```

## Steps

1. Create a branch `feat/packet-store-runs` from `main`.
2. Make the file changes above.
3. Run the vault checks.

   ```bash
   node --test "00 System/Scripts/navigation-audit.test.js"
   (cd .obsidian/plugins/work-os && npm run verify)
   git diff --check
   ```

4. Open a PR titled `feat(packets): ignore stage runs and add the packet-store config`.
5. Merge after CI passes.

## Done when

The three commands above exit 0. The PR is merged. `git check-ignore -v "10 Tasks/Packets/ATT-5387/stages/20-ac-walkthrough/runs/v1/run.md"` prints the new rule.

## Evidence

```text
```

## Rollback

Revert the PR.
