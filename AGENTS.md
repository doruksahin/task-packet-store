# task-packet-store — Agent Guide

Read `docs/design/README.md` first. The CLI contract in `docs/design/03-architecture.md` is
authoritative over this file.

## Non-negotiable rules

1. Operations are written once against `PacketTransport`. Never branch on the driver inside an operation.
2. rclone owns transport. Never parse Drive API responses. Never write a Drive client in this repository.
3. Credentials come only from `PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS` or `PACKET_STORE_DRIVE_TOKEN`. Strip ambient `RCLONE_*`. Never log them.
4. A filter has includes or excludes, never both.
5. `fetch` and `push` exclude `/stages/*/runs/**`. `pull` includes only `/*/runs/**`.
6. `packetSha256` keeps the formula of the walkthrough's `run-history.ts`. Change both or neither.
7. Every command prints one JSON object on stdout. Exit 0, 1, 2 as documented.

## Verification

`pnpm check` after a change. `pnpm release:check` before a release candidate.
