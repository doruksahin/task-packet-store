---
status: in-progress
step: 05a
title: Result locations and Drive links
---

# Step 05a. Result locations and Drive links

## Outcome

A consumer can obtain the actual location of an existing packet folder, run folder, or HTML file.
Drive returns a usable link; local storage returns an absolute filesystem path.

## Owner, dependencies, and inputs

- Owner: `task-packet-store`.
- Depends on step 05's implemented transports; the real-Drive proof needs step 01.
- Inputs: store configuration, ticket, and a path relative to the packet root. The empty relative
  path identifies the packet folder.

## Work

1. Define the smallest package interface for looking up an existing result location. Record its
   exact invocation, result shape, and failure behavior in
   [the architecture](../design/03-architecture.md) before implementing it. This interface is a
   planned addition; no new location command is available today.
2. Implement the operation once against `PacketTransport`. Put backend-specific resolution in
   `FsTransport` and `RcloneTransport`. Keep existing transfer commands and digest behavior intact.
3. Resolve Drive links from rclone's observed object metadata. Use the existing access permissions;
   obtaining a location must be read-only. The package continues to own rclone invocation and
   credential handling.
4. Cover the three caller needs: packet folder, numbered run folder, and actual HTML file. A missing
   object must report failure rather than return a plausible-looking link. A local result must
   resolve to the existing file or directory without Drive credentials or rclone.
5. Run the shared operation checks and `pnpm check`. Use step 01's scratch destination to prove
   that the returned Drive folder/file links address the saved objects and an authorized teammate
   can use them.

## Done when

- The architecture and package help/API reference document one implemented location interface.
- Both transports meet the same caller contract; the local path works without Drive setup.
- Real packet-folder, run-folder, and HTML links resolve to the intended objects.
- Lookup does not alter file contents or sharing permissions.
- Tests and the real-Drive link proof are recorded.

## Evidence

Pending. Record:

- Implementation commit and exact consumer invocation/result examples with neutral ticket IDs.
- Local path checks and `pnpm check` result.
- CI run URL, tested object paths, returned Drive links, and link-opening results.

## Handoff and rollback

Give step 06 the release-ready interface and give steps 08/09 its exact invocation and result keys.
If implementation fails, revert the addition; the completed transfer operations remain available.
