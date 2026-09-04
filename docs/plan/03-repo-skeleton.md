---
status: done
step: 03
title: Repository skeleton
---

# Step 03. Repository skeleton

## Goal

This directory is a buildable, testable, releasable Node package with zero features, on the same
rail as `jira-markdown-exporter`.

## Depends on

None.

## Files

Copy from `/Users/doruk/Desktop/PROJECTS/tools/jira-markdown-exporter` (E below) into this
repository (R below). Then edit as listed.

| Copy | Edit after copy |
| --- | --- |
| `E/.github/workflows/ci.yml` | Add the rclone install step from `docs/design/04-server-operation.md` before "Run the release gate" |
| `E/.github/workflows/release-please.yml` | none |
| `E/release-please-config.json` | none |
| `E/.release-please-manifest.json` | set the version to `0.0.0` |
| `E/tsconfig.json` | none |
| `E/.gitignore` | none |
| `E/LICENSE` | none |
| `E/scripts/clean-dist.mjs` | none |
| `E/scripts/build-release-artifact.mjs` | replace `jira-markdown-exporter` with `task-packet-store` |
| `E/scripts/smoke-installed-artifact.mjs` | replace the binary name with `task-packet-store` and the smoke command with `task-packet-store --help` |
| `E/scripts/upload-release-artifacts.mjs` | replace the package name |
| `E/scripts/publish-release-artifact.mjs` | replace the package name |
| `E/test/release-artifact.test.ts` | replace names, expected tarball filename |
| `E/test/release-publication.test.ts` | replace names |
| `E/test/core/package-boundary.test.ts` | keep the allowlist check, replace names, assert `bin.task-packet-store` |

Create:

- `package.json`
- `AGENTS.md`
- `CLAUDE.md` containing one line: `@AGENTS.md`
- `src/cli.ts` with `--help` only
- `test/cli.test.ts`

## Steps

1. Initialize tooling.

   ```bash
   cd /Users/doruk/Desktop/PROJECTS/tools/task-packet-store
   corepack enable
   corepack use pnpm@10
   ```

2. Write `package.json`.

   ```json
   {
     "name": "@doruksahin/task-packet-store",
     "version": "0.0.0",
     "description": "Read and write task packets from a local file system or Google Drive.",
     "license": "MIT",
     "type": "module",
     "repository": { "type": "git", "url": "git+https://github.com/doruksahin/task-packet-store.git" },
     "homepage": "https://github.com/doruksahin/task-packet-store#readme",
     "bugs": { "url": "https://github.com/doruksahin/task-packet-store/issues" },
     "engines": { "node": ">=20" },
     "bin": { "task-packet-store": "dist/cli.js" },
     "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
     "files": ["dist", "README.md", "docs/design/03-architecture.md", "docs/design/04-server-operation.md"],
     "publishConfig": { "access": "public", "registry": "https://registry.npmjs.org" },
     "scripts": {
       "build": "node scripts/clean-dist.mjs && tsc -p tsconfig.json",
       "typecheck": "tsc -p tsconfig.json --noEmit",
       "test": "pnpm build && vitest run --exclude test/release-artifact.test.ts && vitest run test/release-artifact.test.ts",
       "check": "pnpm typecheck && pnpm test",
       "prepack": "pnpm build",
       "release:artifact": "node scripts/build-release-artifact.mjs",
       "release:smoke-install": "node scripts/smoke-installed-artifact.mjs",
       "release:check": "pnpm check && npm pack --dry-run --ignore-scripts"
     },
     "dependencies": { "commander": "^14.0.3", "yaml": "^2.8.0", "zod": "^4.0.0" },
     "devDependencies": { "@types/node": "^22.15.3", "tsx": "^4.21.0", "typescript": "^5.8.3", "vitest": "^3.1.2" }
   }
   ```

3. Write the failing CLI test at `test/cli.test.ts`.

   ```ts
   import { execFileSync } from 'node:child_process';
   import { describe, expect, it } from 'vitest';

   describe('cli', () => {
     it('prints help that names every command', () => {
       const help = execFileSync('node', ['dist/cli.js', '--help'], { encoding: 'utf8' });
       for (const command of ['fetch', 'push', 'begin', 'checkpoint', 'pull', 'doctor']) {
         expect(help).toContain(command);
       }
     });
   });
   ```

4. Run it. Expected: FAIL, `dist/cli.js` does not exist.

   ```bash
   pnpm install && pnpm build && pnpm vitest run test/cli.test.ts
   ```

5. Write the minimal `src/cli.ts`.

   ```ts
   #!/usr/bin/env node
   import { Command } from 'commander';

   const program = new Command()
     .name('task-packet-store')
     .description('Read and write task packets from a local file system or Google Drive.')
     .showHelpAfterError();

   for (const [name, summary] of [
     ['fetch', 'Download one frozen packet without runs into <destination>/<TICKET>.'],
     ['push', 'Upload one packet from a local directory, without runs.'],
     ['begin', 'Reserve the next runs/vN for a stage and write run.md.'],
     ['checkpoint', 'Upload a source directory into the reserved run and write snapshot.json.'],
     ['pull', 'Download every stages/*/runs/** into a local packet.'],
     ['doctor', 'Report rclone version, credential variables, and the resolved remote.'],
   ] as const) {
     program.command(name).description(summary).action(() => {
       process.stderr.write(`${name}: not implemented\n`);
       process.exitCode = 1;
     });
   }

   program.parseAsync(process.argv);
   ```

6. Add the shebang permission in `tsconfig.json` output or in `scripts/clean-dist.mjs` as the
   exporter does. Run the test. Expected: PASS.

7. Write `AGENTS.md`.

   ```markdown
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
   ```

8. Commit.

   ```bash
   git add -A && git commit -m "chore: scaffold package on the exporter release rail"
   ```

## Deviations

The scaffold commit and the code-quality review fixes that followed differ from the steps above in
these points. The code is the record of truth. This list explains why it differs.

1. `release-please.yml` was not copied unchanged. Three path and tarball renames were needed in the
   artifact steps: the release directory `$RUNNER_TEMP/task-packet-store-release` and the tarball
   `doruksahin-task-packet-store-<version>.tgz` in "Build and verify", "Attach or verify", and
   "Publish or verify".
2. `release-please-config.json` was not copied unchanged. `package-name` is
   `@doruksahin/task-packet-store` and `bootstrap-sha` is the docs-only commit `75ac8b4`.
3. `src/version.ts` was created with the `x-release-please-version` marker. The copied config lists
   it under `extra-files`, and the boundary test checks that the runtime version matches
   `package.json`.
4. `schemas` is not in `files`. No plan step creates a `schemas/` directory: steps 04 and 05 keep
   the schemas as zod objects in `src/`. The boundary test pins the four-entry list `dist`,
   `README.md`, and the two shipped design documents.
5. Step 6 needs no chmod. `tsc` keeps the `#!/usr/bin/env node` line, and npm sets the executable
   bit on `bin` entries at install time. The exporter relies on the same behaviour.
6. `packageManager` is pinned to `pnpm@10.33.0`, not `pnpm@10`, so that `corepack enable` in CI
   resolves one exact version.
7. `tsx` is not a devDependency. Nothing referenced it.
8. Usage errors exit 2. `src/cli.ts` calls `exitOverride()` and maps every `CommanderError` with a
   non-zero exit code to 2. Help and version keep 0. `test/cli.test.ts` is a table-driven contract
   test over `spawnSync` rather than the single help check in step 3.
9. The rclone install is a composite action, `.github/actions/install-rclone`, used by `ci.yml` and
   by the publish job of `release-please.yml`. The inline step named in the Files table was the
   first version.
10. `package.json` has `homepage` and `bugs.url`, like the exporter.

## Done when

```bash
pnpm check
node dist/cli.js --help
```

Expected: all tests pass, help lists six commands.

## Evidence

```text
$ pnpm check   (tail -15)
      Tests  12 passed (12)
   Start at  16:29:52
   Duration  2.42s (transform 185ms, setup 0ms, collect 204ms, tests 2.14s, environment 0ms, prepare 186ms)


 RUN  v3.2.7 /Users/doruk/Desktop/PROJECTS/tools/task-packet-store

 ✓ test/release-artifact.test.ts (3 tests) 2970ms
   ✓ release artifact command > creates a checksummed npm archive reproducibly in explicit empty directories  2894ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  16:29:55
   Duration  3.23s (transform 28ms, setup 0ms, collect 31ms, tests 2.97s, environment 0ms, prepare 44ms)

$ node dist/cli.js --help
Usage: task-packet-store [options] [command]

Read and write task packets from a local file system or Google Drive.

Options:
  -h, --help      display help for command

Commands:
  fetch           Download one frozen packet without runs into
                  <destination>/<TICKET>.
  push            Upload one packet from a local directory, without runs.
  begin           Reserve the next runs/vN for a stage and write run.md.
  checkpoint      Upload a source directory into the reserved run and write
                  snapshot.json.
  pull            Download every stages/*/runs/** into a local packet.
  doctor          Report rclone version, credential variables, and the resolved
                  remote.
  help [command]  display help for command

$ pnpm check   (tail -15, after the review fixes: exit 2 contract test, composite rclone action, tsx removed)
      Tests  20 passed (20)
   Start at  16:54:31
   Duration  2.63s (transform 152ms, setup 0ms, collect 175ms, tests 2.67s, environment 0ms, prepare 198ms)


 RUN  v3.2.7 /Users/doruk/Desktop/PROJECTS/tools/task-packet-store

 ✓ test/release-artifact.test.ts (3 tests) 3408ms
   ✓ release artifact command > creates a checksummed npm archive reproducibly in explicit empty directories  3331ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  16:54:34
   Duration  3.64s (transform 28ms, setup 0ms, collect 27ms, tests 3.41s, environment 0ms, prepare 62ms)
```

## Rollback

`git reset --hard` to the docs-only commit.
