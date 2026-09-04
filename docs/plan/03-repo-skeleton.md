---
status: in-progress
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
     "engines": { "node": ">=20" },
     "bin": { "task-packet-store": "dist/cli.js" },
     "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
     "files": ["dist", "schemas", "README.md", "docs/design/03-architecture.md", "docs/design/04-server-operation.md"],
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

## Done when

```bash
pnpm check
node dist/cli.js --help
```

Expected: all tests pass, help lists six commands.

## Evidence

```text
```

## Rollback

`git reset --hard` to the docs-only commit.
