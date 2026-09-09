import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { createGitRunner, GitTransport, gitEnv } from '../src/git.js';
import { locateResult } from '../src/operations.js';
import {
  cleanupTempDirs,
  exerciseFetchAndPush,
  exerciseRuns,
  tempDir,
  writeTree,
  type Harness,
} from './operations.shared.js';

/** The transport reads the ambient environment; the fixture keeps a minimal one so no user config leaks in. */
const GIT_ENV = { PATH: process.env.PATH ?? '' };
const hasGit = spawnSync('git', ['--version'], { stdio: 'ignore' }).status === 0;
/** The same identity the transport commits with, so a seeded history matches a pushed one. */
const AUTHOR = ['-c', 'user.name=task-packet-store', '-c', 'user.email=task-packet-store@localhost', '-c', 'commit.gpgsign=false'];
const PREFIX = 'packets';

afterEach(cleanupTempDirs);

function git(args: string[]) {
  return spawnSync('git', args, { encoding: 'utf8', env: GIT_ENV });
}

function gitOk(args: string[]): string {
  const result = git(args);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

function makeGitHarness(): Harness {
  const bare = tempDir('tps-bare-');
  if (git(['init', '--bare', '--initial-branch=main', bare]).status !== 0) {
    gitOk(['init', '--bare', bare]);
    gitOk(['-C', bare, 'symbolic-ref', 'HEAD', 'refs/heads/main']);
  }
  const remote = `file://${bare}`;
  const config = parseStoreConfig({ driver: 'git', remote, prefix: PREFIX });
  if (config.driver !== 'git') throw new Error('unreachable');
  return {
    transport: new GitTransport(createGitRunner(gitEnv(GIT_ENV)), config),
    config,
    seed: (ticket, tree) => {
      const work = tempDir('tps-seed-');
      if (git(['clone', '--branch', 'main', remote, work]).status !== 0) {
        gitOk(['init', '--initial-branch=main', work]);
        gitOk(['-C', work, 'remote', 'add', 'origin', remote]);
      }
      writeTree(path.join(work, PREFIX, ticket), tree);
      gitOk(['-C', work, 'add', '--', `${PREFIX}/${ticket}`]);
      gitOk(['-C', work, ...AUTHOR, 'commit', '-m', `seed ${ticket}`]);
      gitOk(['-C', work, 'push', 'origin', 'HEAD:main']);
      fs.rmSync(work, { recursive: true, force: true });
    },
    remoteFile: (ticket, relative) => {
      const shown = git(['-C', bare, 'show', `main:${PREFIX}/${ticket}/${relative}`]);
      return shown.status === 0 ? shown.stdout : null;
    },
  };
}

describe.skipIf(!hasGit)('operations through GitTransport (bare file remote)', () => {
  exerciseFetchAndPush(makeGitHarness);
  exerciseRuns(makeGitHarness);

  it('locates a saved report at a commit that resolves in any clone of the remote', async () => {
    const h = makeGitHarness();
    if (h.config.driver !== 'git') throw new Error('unreachable');
    const relative = 'delivery/report.html';
    h.seed('PROJ-123', { [relative]: '<html>saved</html>' });
    const bare = h.config.remote.slice('file://'.length);
    const head = gitOk(['-C', bare, 'rev-parse', 'main']).trim();
    expect(await locateResult(h.transport, 'PROJ-123', relative)).toEqual({
      ticket: 'PROJ-123',
      driver: 'git',
      relativePath: relative,
      kind: 'file',
      location: `${h.config.remote}#${head}:${PREFIX}/PROJ-123/${relative}`,
    });
    expect(gitOk(['-C', bare, 'show', `${head}:${PREFIX}/PROJ-123/${relative}`])).toBe('<html>saved</html>');
    await expect(locateResult(h.transport, 'PROJ-123', 'delivery/missing.html')).rejects.toThrow('STORE_LOCATION_MISSING');
    await expect(locateResult(h.transport, 'PROJ-999')).rejects.toThrow('STORE_LOCATION_MISSING');
  });
});

if (process.env.CI && !hasGit) throw new Error('git is required in CI');
