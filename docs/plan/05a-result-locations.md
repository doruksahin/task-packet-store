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
   [the architecture](../design/03-architecture.md) before implementing it. The implemented
   interface is recorded below; publication belongs to step 06.
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

Implementation and live Drive/user-access checks completed on 2026-09-05; fresh GitHub runner
evidence is still pending.

- Contract-before-code commit: `d1e6f77` (`docs: define read-only result location contract`).
- Review: [PR #2](https://github.com/doruksahin/task-packet-store/pull/2), branch `codex/result-locations`.
- Implementation commit: `6a7c5d9` (`feat: locate existing packet result paths and Drive links`).
- `pnpm install --frozen-lockfile` succeeded without lockfile changes. The first `pnpm check`
  attempt identified absent worktree dependencies; after installation, `pnpm check` passed.
- Initial implementation check: `pnpm check` passed typecheck/build and all **179 tests** (176
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
- PR CI [run 33959306288](https://github.com/doruksahin/task-packet-store/actions/runs/33959306288)
  stopped before the release gate in the inherited install-rclone action: exported
  `RCLONE_VERSION=v1.75.0` was parsed by rclone as its boolean `--version` option. Download and
  checksum succeeded. The orchestrator owns this bootstrap fix; it is not changed in this branch.
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

Independent review correction (`c242f224a7e53e26f7a158a0c8b7ee3b843d3fe7`):
`delivery/report.html/report.html` must fail when
`delivery/report.html` is a file. Real rclone 1.75.0 lists a file as its own entry; a fixture adding
only its Drive ID reproduced a false successful URL before the fix. The regression command
`pnpm exec vitest run test/operations.rclone.test.ts -t 'nonexistent child'` failed before the fix
and passed afterward. Both fs and rclone now reject this request with `STORE_LOCATION_MISSING`.
The transport establishes the parent's directory type with read-only `lsjson --stat` before
listing for the actual object ID. Parent stat with missing/invalid type metadata fails closed;
missing parent codes retain the missing-location error. The updated `pnpm check` passes all
**190 tests** (187 core/integration plus 3 artifact), including the real-rclone regression.

Bootstrap integration: merged upstream `9c07cf9` as `e96f9a4`; the corrected installer and Node 20
release gate passed in [CI run 33959406490](https://github.com/doruksahin/task-packet-store/actions/runs/33959406490).
The earlier installer failure above is historical.

The corrected head `c242f224a7e53e26f7a158a0c8b7ee3b843d3fe7` passed the Node 20 release gate in
[CI run 33959601582](https://github.com/doruksahin/task-packet-store/actions/runs/33959601582).
Independent reviewer task `01a07100-632d-7cc1-b34c-621e05de8e00` re-reviewed that exact head:
prior P2 resolved, no remaining actionable Standards/Spec findings, independent `pnpm check`
passed all 190 tests with no skips, and `git diff --check` passed.

### Real Shared Drive lookup and reader proof (2026-09-05)

The step 01 CI-access task ran the candidate locally against the real Shared Drive using its
service account, with exact packet-store candidate `c242f224a7e53e26f7a158a0c8b7ee3b843d3fe7`.
This is live Drive proof, not a GitHub Actions run. The scratch prefix was
`ci-smoke/1788602767-1`, ticket `TPS-1788602767`. Packet SHA:
`0e6a76ded20cceca0c3a054b0cd1ea94501a60096b6e91f4f4120c0a14beec69`.
Checkpoint inventory SHA:
`d4f8be0bff9f56d50f257043ab0d3e4c0ad45feb5b56204eb65ec7d0839cda3`.

All three calls used `locate --store <absolute scratch config> --ticket TPS-1788602767`, adding
`--path` as below; each exited 0 and returned one JSON result with `driver: "gdrive"`:

| Relative path | Kind | Actual returned location |
| --- | --- | --- |
| empty | directory | [Packet folder](https://drive.google.com/drive/folders/1DL_Nxpv61_DnQj4TPcQYAeXUM653xKc3) |
| `stages/20-ac-walkthrough/runs/v1` | directory | [Run folder](https://drive.google.com/drive/folders/182lFpYif0jyU9CDKUof640J_SFkgpiNa) |
| `stages/20-ac-walkthrough/runs/v1/delivery/report.html` | file | [HTML file](https://drive.google.com/file/d/1Y6aKb8I54yhBewzLvRgHVqOsxOAtAmIy/view) |

`--path missing.txt` and
`--path stages/20-ac-walkthrough/runs/v1/delivery/report.html/report.html` each returned exit 1,
zero stdout bytes, and `STORE_LOCATION_MISSING`.

Existing human-account access was independently exercised after service-account lookup:

- This task opened the actual packet link in the in-app browser. The authenticated Appier account
  saw title `TPS-1788602767 - Google Drive` and entries `stages`, `jira`, `task.md` (57 bytes), and
  `00 Packet.md` (24 bytes), without a permission prompt. The URL normalized to the same object ID
  under `/drive/u/1/folders/`.
- The orchestrator verified the connected Google Drive profile for `doruk.sahin@appier.com`,
  retrieved metadata for all three returned object IDs, and listed the packet and run. Listings
  contained the expected packet directories and `run.md`, `delivery`, `evidence`, `snapshot.json`.
- Fetching the actual HTML link through that connected human account returned exactly
  `<!doctype html><title>Drive CI smoke</title>` followed by one newline. This is an authenticated
  retrieval proof, not a claim that Drive renders HTML as a hosted website.
- These checks used inherited Shared Drive access. No contents or sharing permissions were changed
  by location lookup or reader verification. The scratch prefix was retained for inspection;
  cleanup is coordinated by the orchestrator and CI-access task.

Package PR #2 was merged by the orchestrator as `bc2744a1596fc0a2d08577ddeb3167d63fbe1152`.
The package correction, local live links, negative lookups, and existing human-account retrieval
are verified. Remaining evidence is the fresh GitHub Actions smoke run URL using the candidate;
step 01 is preparing that workflow. This step stays `in-progress` until the CI evidence is recorded.
The orchestrator owns the plan board and release/dependent actions.

## Handoff and rollback

Give step 06 the release-ready interface and give steps 08/09 its exact invocation and result keys.
If implementation fails, revert the addition; the completed transfer operations remain available.
