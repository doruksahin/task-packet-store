# task-packet-store — Agent Guide

Read the [design index](docs/design/README.md) for task orientation. The
[CLI contract](docs/design/03-architecture.md) is authoritative for package behavior.

When changing package responsibilities, public interfaces, dependencies, execution/storage
integration, failure behavior, or architecture documentation, start with
[the architecture page](docs/architecture/README.md); follow only the owner links needed for the change.
For documentation and agent-guide edits, use the [link-check procedure](docs/maintenance.md#check-links).

## Non-negotiable rules

1. Operations are written once against `PacketTransport`. Never branch on the driver inside an operation.
2. rclone owns Drive transport. Never parse Drive API responses. Never write a Drive client in this repository.
3. Credentials come only from `PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS` or `PACKET_STORE_DRIVE_TOKEN`. Strip ambient `RCLONE_*`. Never log them.
   3a. Help text and examples use neutral identifiers such as `PROJ-123`, never a consumer's project key.
4. A filter has includes or excludes, never both.
5. `fetch` and `push` exclude `/stages/*/runs/**`. `pull` includes only `/*/runs/**`.
6. `packetSha256` keeps the formula of the walkthrough's [run-history implementation](https://github.com/AdCreative-ai/AC-visual-walkthrough/blob/main/packages/ac-walkthrough-plugin/runtime/scripts/src/run-history.ts). Change both or neither.
7. On success every command prints exactly one JSON object on stdout. On failure stdout is empty and stderr has one line `CODE: message`. Exit 0 on success, 2 for usage or configuration errors (including commander usage errors), 1 for everything else.
8. The git driver uses git's own credentials (SSH agent or credential helper). Never read, forward, or log a token for it. It contains no LFS logic; the remote's `.gitattributes` and an installed `git-lfs` decide that.

## Verification

Run the [checks for the change](docs/maintenance.md): `pnpm check` after a change and
`pnpm release:check` before a release candidate.
