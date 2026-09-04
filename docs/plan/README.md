# task-packet-store PoC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan
> task-by-task. Read `docs/design/README.md` first. Each task below is one checkpoint document.

**Goal:** Run the ac-implementation-verification walkthrough in GitHub Actions where the packet comes
from a Google Shared Drive and the run lands in `packets/ATT-5387/stages/20-ac-walkthrough/runs/v1/`
on that drive, then appears in the vault after `pull`.

**Architecture:** One npm package with a CLI. Operations are written once against a `PacketTransport`
interface. `FsTransport` uses `node:fs`. `RcloneTransport` spawns a pinned rclone binary with a
Drive connection string. The vault ignores `runs/` in Git.

**Tech Stack:** Node 20, TypeScript, zod, yaml, commander, vitest, rclone 1.75.0, Google Shared
Drive with a service account, Release Please, npm trusted publishing.

---

## Checkpoint protocol

Each step document has `status` in its frontmatter: `pending`, `in-progress`, `done`, `blocked`.
Set `in-progress` before you start. Paste the "Done when" output into "Evidence". Set `done`.
Update this board. Commit the step document and this board together.

## Board

| Step | Document | Where | Depends on | Status |
| --- | --- | --- | --- | --- |
| 01 | [Google Workspace setup](01-google-workspace.md) | Google Admin, GCP | none | pending |
| 02 | [Local rclone and token](02-local-rclone.md) | laptop | 01 | pending |
| 03 | [Repository skeleton](03-repo-skeleton.md) | this repo | none | done |
| 04 | [Config, identity, fs transport, fetch, push](04-fetch-and-push.md) | this repo | 03 | done |
| 05 | [rclone transport, begin, checkpoint, pull](05-runs.md) | this repo | 04, 02 for the manual round trip | pending |
| 06 | [Release 0.1.0](06-release.md) | this repo, npm | 05 | pending |
| 07 | [Vault PR](07-vault-pr.md) | adc-vault | none | pending |
| 08 | [First push of ATT-5387](08-first-push.md) | laptop | 02, 06, 07 | pending |
| 09 | [Walkthrough PR](09-walkthrough-pr.md) | AC-visual-walkthrough | 06, 08 | pending |
| 10 | [Pull and verify in Obsidian](10-pull-and-verify.md) | laptop | 09 | pending |
| 11 | [Recon as second consumer](11-recon-consumer.md) | recon-plugin | 06 | pending |
| 12 | [Cleanup](12-cleanup.md) | AC-visual-walkthrough | 10 | pending |

## Order

- Steps 01 and 02 need Doruk. Start them first because they wait on Google Admin.
- Steps 03 to 06 are one package. Run them in sequence.
- Step 07 can run in parallel with 03 to 06.
- Steps 08 to 12 need the published version from 06.

## Conventions for every step in this repository

- Commit after each green test run. Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- Run `pnpm check` before every commit that touches `src/` or `test/`.
- Code in the step documents is the reference implementation. Keep the contract from
  `docs/design/03-architecture.md` when you adjust names.
