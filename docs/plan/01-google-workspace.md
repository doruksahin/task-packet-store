---
status: pending
step: 01
title: Google Workspace setup
---

# Step 01. Google Workspace setup

## Goal

A Shared Drive exists. A service account can list it. Its key is a GitHub secret.

## Depends on

None. Needs Doruk with Google Admin and GCP access at Appier.

## Steps

1. In Google Drive, create a Shared Drive named `ADC Task Packets`.
2. Open the Shared Drive. Copy its id from the URL. The id follows `/drive/folders/`.
   Record it below as `sharedDriveId`.
3. In Google Cloud Console, create or select a project for AdCreative tooling.
4. Enable the API named `Google Drive API` in that project.
5. Create a service account named `task-packet-store-ci`. Do not grant project roles.
6. Create a JSON key for the service account. Download it once. Do not commit it.
7. In the Shared Drive, add the service account email as a member with the role `Content manager`.
8. In the GitHub repository `doruksahin/AC-visual-walkthrough`, add the secret
   `PACKET_STORE_DRIVE_SERVICE_ACCOUNT` with the complete JSON key as its value.
9. Delete the local copy of the key file after step 02 confirms access.

## Done when

Run this on the laptop with the key file present. Replace the two placeholders.

```bash
RCLONE_DRIVE_SERVICE_ACCOUNT_FILE=/absolute/path/key.json \
  rclone lsd ":drive,team_drive=<sharedDriveId>:"
```

Expected: exit 0 and an empty or short listing. An error that mentions `storageQuotaExceeded` or
`insufficientPermissions` means the drive is not a Shared Drive or the account is not a member.

## Evidence

```text
sharedDriveId:
service account email:
rclone lsd output:
```

## Rollback

Remove the member from the Shared Drive. Delete the service account key in GCP. Delete the GitHub
secret.
