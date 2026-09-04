---
status: pending
step: 02
title: Local rclone and token
---

# Step 02. Local rclone and token

## Goal

rclone 1.75.0 is installed on the laptop. A personal OAuth token exists in the shell environment as
`PACKET_STORE_DRIVE_TOKEN`.

## Depends on

Step 01 for the `sharedDriveId`.

## Steps

1. Install rclone.

   ```bash
   brew install rclone
   rclone version
   ```

   Expected first line: `rclone v1.75.0`. A newer patch version is acceptable. Record it.

2. Create a token for your own Google account. A browser window opens. Approve access.

   ```bash
   rclone authorize "drive"
   ```

   The command prints a JSON token between `--->` and `<---`. Copy only the JSON.

3. Store the token outside the repository. With direnv, add to `~/.config/direnv/direnvrc` or the
   vault's `.envrc` (git-ignored):

   ```bash
   export PACKET_STORE_DRIVE_TOKEN='<the JSON on one line>'
   ```

   Without direnv, put the same line in `~/.zshrc.local` and source it from `~/.zshrc`.

## Done when

```bash
RCLONE_DRIVE_TOKEN="$PACKET_STORE_DRIVE_TOKEN" rclone lsd ":drive,team_drive=<sharedDriveId>:"
```

Expected: exit 0.

## Evidence

```text
rclone version: v1.75.0
lsd exit code:
```

## Rollback

Revoke the token at https://myaccount.google.com/permissions under "rclone". Remove the export.
