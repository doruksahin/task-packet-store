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

Local implementation completed on 2026-09-05; live Drive acceptance is still pending.

- Contract-before-code commit: `d1e6f77` (`docs: define read-only result location contract`).
- Review: [PR #2](https://github.com/doruksahin/task-packet-store/pull/2), branch `codex/result-locations`.
- Implementation commit: `6a7c5d9` (`feat: locate existing packet result paths and Drive links`).
- `pnpm install --frozen-lockfile` succeeded without lockfile changes. The first `pnpm check`
  attempt identified absent worktree dependencies; after installation, `pnpm check` passed.
- Final implementation check: `pnpm check` passed typecheck/build and all **179 tests** (176
  core/integration plus 3 artifact tests). The existing shared transfer/run suite ran against fs
  and installed rclone **1.75.0**. No tests were skipped.
- `test/locations.test.ts` exercises the same result contract with FsTransport and RcloneTransport
  using observed-ID metadata fixtures: packet, run folder, HTML, missing objects, path rejection,
  and no writes. It separately verifies duplicate/invalid metadata and absent-parent failures.
  `test/operations.rclone.test.ts` uses the real local rclone backend to prove missing objects fail
  as missing and existing objects without Drive IDs fail rather than produce guessed URLs.
- CLI integration verifies all three fs locations with `PATH=/nonexistent` and no Drive credential
  variables. It verifies one JSON line on success, empty stdout and one error line on failure,
  exit 1 for missing objects, and exit 2 for unsafe relative paths.
- `git diff --check` passed. Transfer commands, filters, identity calculation, release configuration,
  and the orchestrator's plan board are unchanged by this step.

Exact consumer invocations (replace the configured absolute store path as appropriate):

```sh
task-packet-store locate --store /abs/store.json --ticket PROJ-123
task-packet-store locate --store /abs/store.json --ticket PROJ-123 \
  --path stages/20-ac-walkthrough/runs/v1
task-packet-store locate --store /abs/store.json --ticket PROJ-123 \
  --path stages/20-ac-walkthrough/runs/v1/delivery/report.html
```

Consumers read `.location`; all results have `ticket`, `driver`, `relativePath`, `kind`, and
`location`. The package root exports `locateResult(transport, ticket, relativePath = '')`,
`LocationResult`, and `ResultLocation`.

A separate local smoke used an environment containing only `PATH=/nonexistent`, invoked the built
`dist/cli.js` via `/Users/doruk/.nvm/versions/node/v24.15.0/bin/node`, and used config
`/var/folders/2d/z1vzz2gd3xg3hhyz394247dh0000gn/T/tps-locate-proof-zoYu7N/store.json`.
The three successful invocations above returned exit 0, empty stderr, and these actual locations:

| Relative path | Kind | Location below the smoke store root |
| --- | --- | --- |
| empty | directory | `PROJ-123` |
| `stages/20-ac-walkthrough/runs/v1` | directory | `PROJ-123/stages/20-ac-walkthrough/runs/v1` |
| `stages/20-ac-walkthrough/runs/v1/delivery/report.html` | file | `PROJ-123/stages/20-ac-walkthrough/runs/v1/delivery/report.html` |

The absolute smoke store root was
`/var/folders/2d/z1vzz2gd3xg3hhyz394247dh0000gn/T/tps-locate-proof-zoYu7N/store`.
`--path missing.html` returned exit 1, empty stdout, and exactly
`STORE_LOCATION_MISSING: PROJ-123/missing.html does not exist` on stderr.
These are temporary local proof files, not portable acceptance artifacts.

Remaining evidence: step 01 must supply its CI scratch destination/access before live packet,
run-folder, and HTML links can be captured here with a CI run URL and authorized teammate opening
results. No real Drive lookup or teammate opening is claimed by the fixture/local checks. The
step remains `in-progress`; the orchestrator owns the plan board and release/dependent actions.

## Handoff and rollback

Give step 06 the release-ready interface and give steps 08/09 its exact invocation and result keys.
If implementation fails, revert the addition; the completed transfer operations remain available.
