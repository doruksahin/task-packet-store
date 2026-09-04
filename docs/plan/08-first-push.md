---
status: pending
step: 08
title: First push of ATT-5387
---

# Step 08. First push of ATT-5387

## Goal

The packet `ATT-5387` is on the Shared Drive and its digest equals the local digest.

## Depends on

Steps 02, 06, 07.

## Steps

```bash
cd /Users/doruk/Desktop/ADCREATIVE/adc-vault
npm install --global @doruksahin/task-packet-store@0.1.0
store="$PWD/00 System/Integrations/Packet Store/packet-store.json"
task-packet-store doctor --store "$store"
task-packet-store push --store "$store" --ticket ATT-5387 --from "$PWD/10 Tasks/Packets/ATT-5387"
```

Compare digests through both drivers:

```bash
local_cfg=$(mktemp); printf '{"driver":"fs","root":"%s"}\n' "$PWD/10 Tasks/Packets" > "$local_cfg"
task-packet-store fetch --store "$local_cfg" --ticket ATT-5387 --destination "$(mktemp -d)" | jq -r .packetSha256
task-packet-store fetch --store "$store" --ticket ATT-5387 --destination "$(mktemp -d)" | jq -r .packetSha256
```

## Done when

The two digests are equal. `rclone lsjson -R ":drive,team_drive=<id>:packets/ATT-5387" | jq length`
equals the number of files in the local packet outside `stages/*/runs/`.

## Evidence

```text
```

## Rollback

`rclone purge ":drive,team_drive=<id>:packets/ATT-5387"`.
