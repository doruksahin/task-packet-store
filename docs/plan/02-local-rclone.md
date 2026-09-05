---
status: pending
step: 02
title: Optional local Drive access
---

# Step 02. Optional local Drive access

## Outcome

An individual operator can fetch packets or pull runs from Drive onto their own machine.
This step is optional and is not needed for CI or for local-only `fs` storage.

## Owner, dependencies, and inputs

- Owner: the individual operator.
- Depends on step 01's destination/access details and step 06's published package.
- Inputs: a local store-config path and a Google account with access to the selected Shared Drive.

## Work

1. Install the package version recorded in step 06 and the pinned rclone version.
2. Obtain a personal OAuth token with `rclone authorize "drive"`. Supply it through
   `PACKET_STORE_DRIVE_TOKEN` using the operator's existing secret-management setup.
3. Copy or provide the credential-free Drive config at an explicit local path.
4. Run `task-packet-store doctor --store <absolute-config-path>`, then fetch a known packet into
   a fresh local directory and pull its runs when needed.

## Done when

The operator can retrieve a packet and its selected stored results through the package. The local
configuration is portable and does not rely on another person's shell or vault path.

## Evidence

Pending. Record package/rclone versions, config path, test ticket, and command outcomes without
credential values.

## Handoff and rollback

This enables optional local viewing and step 07. Revoke only the newly created personal token if
the operator abandons the setup; CI's service account is independent.
