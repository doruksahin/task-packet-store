import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseStoreConfig, type GitConfig } from '../src/config.js';
import { createGitRunner, GitTransport, gitEnv, type GitResult, type GitRunner } from '../src/git.js';
import { cleanupTempDirs, tempDir, writeTree } from './operations.shared.js';

afterEach(cleanupTempDirs);

const OK: GitResult = { code: 0, stdout: '', stderr: '' };
const REMOTE = 'https://example.invalid/team/packets.git';
const hasGit = spawnSync('git', ['--version'], { stdio: 'ignore' }).status === 0;

function gitConfig(overrides: Record<string, unknown> = {}): GitConfig {
  const config = parseStoreConfig({ driver: 'git', remote: REMOTE, prefix: 'packets', ...overrides });
  if (config.driver !== 'git') throw new Error('unreachable');
  return config;
}

interface FakeGit extends GitRunner {
  calls: string[][];
}

/** Records every invocation. `reply` overrides the default success only for the commands a test cares about. */
function fakeGit(reply: (args: string[]) => GitResult | void = () => {}): FakeGit {
  const calls: string[][] = [];
  return {
    calls,
    run: async (args) => {
      calls.push(args);
      return reply(args) ?? OK;
    },
  };
}

function sourceDir(tree: Record<string, string>): string {
  const directory = tempDir('tps-source-');
  writeTree(directory, tree);
  return directory;
}

describe('git runner and environment', () => {
  it('reports a missing binary instead of a transport failure', async () => {
    await expect(createGitRunner({}, 'tps-absent-git').run(['--version'])).rejects.toThrow('STORE_GIT_UNAVAILABLE');
  });

  it('keeps the ambient environment and never prompts for credentials', () => {
    expect(gitEnv({ SSH_AUTH_SOCK: '/tmp/agent.sock', GIT_SSH_COMMAND: 'ssh -F /dev/null' })).toEqual({
      SSH_AUTH_SOCK: '/tmp/agent.sock',
      GIT_SSH_COMMAND: 'ssh -F /dev/null',
      GIT_TERMINAL_PROMPT: '0',
    });
  });
});

describe('git transport', () => {
  it('commits with a fixed identity and no signing', async () => {
    const runner = fakeGit();
    await new GitTransport(runner, gitConfig()).writeText('PROJ-123', 'run.md', 'record\n');
    expect(runner.calls.find((args) => args.includes('commit'))).toEqual([
      '-C', expect.any(String),
      '-c', 'user.name=task-packet-store',
      '-c', 'user.email=task-packet-store@localhost',
      '-c', 'commit.gpgsign=false',
      'commit', '-m', 'writeText PROJ-123 run.md',
    ]);
  });

  it('initializes the branch when the remote has none yet, then pushes it', async () => {
    const runner = fakeGit((args) =>
      args[0] === 'clone'
        ? { code: 128, stdout: '', stderr: 'fatal: Remote branch main not found in upstream origin\n' }
        : undefined,
    );
    await new GitTransport(runner, gitConfig()).upload('PROJ-123', sourceDir({ 'task.md': '# task\n' }), '');
    expect(runner.calls[1]?.slice(0, 2)).toEqual(['init', '--initial-branch=main']);
    expect(runner.calls[2]?.slice(2)).toEqual(['remote', 'add', 'origin', REMOTE]);
    expect(runner.calls.at(-1)?.slice(2)).toEqual(['push', 'origin', 'HEAD:main']);
  });

  it('pushes nothing when the copy changed no file', async () => {
    const runner = fakeGit((args) =>
      args.includes('commit')
        ? { code: 1, stdout: 'On branch main\nnothing to commit, working tree clean\n', stderr: '' }
        : undefined,
    );
    await new GitTransport(runner, gitConfig()).upload('PROJ-123', sourceDir({ 'task.md': '# task\n' }), '');
    expect(runner.calls.some((args) => args.includes('push'))).toBe(false);
  });

  it('fails a rejected push with the first stderr line and does not retry', async () => {
    const runner = fakeGit((args) =>
      args.includes('push')
        ? { code: 1, stdout: '', stderr: ' ! [rejected] HEAD -> main (fetch first)\nerror: failed to push some refs\n' }
        : undefined,
    );
    const upload = new GitTransport(runner, gitConfig()).upload('PROJ-123', sourceDir({ 'task.md': '# task\n' }), '');
    await expect(upload).rejects.toThrow('STORE_GIT_FAILED: git push failed with exit 1: ! [rejected] HEAD -> main (fetch first)');
    expect(runner.calls.filter((args) => args.includes('push'))).toHaveLength(1);
  });

  it('pins a location to the commit, with no trailing slash for a directory', async () => {
    const commit = 'a'.repeat(40);
    const run = 'stages/20-ac-walkthrough/runs/v1';
    const runner = fakeGit((args) => {
      if (args[0] === 'clone') writeTree(path.join(args[args.length - 1], 'packets', 'PROJ-123'), { [`${run}/report.html`]: '<html/>' });
      if (args.includes('rev-parse')) return { code: 0, stdout: `${commit}\n`, stderr: '' };
    });
    const transport = new GitTransport(runner, gitConfig());
    expect(await transport.locate('PROJ-123', run)).toEqual({
      kind: 'directory',
      location: `${REMOTE}#${commit}:packets/PROJ-123/${run}`,
    });
    expect(await transport.locate('PROJ-123', `${run}/report.html`)).toEqual({
      kind: 'file',
      location: `${REMOTE}#${commit}:packets/PROJ-123/${run}/report.html`,
    });
    expect(await transport.locate('PROJ-123', '')).toEqual({
      kind: 'directory',
      location: `${REMOTE}#${commit}:packets/PROJ-123`,
    });
    expect(await transport.locate('PROJ-123', 'missing.html')).toBeNull();
  });
});

describe.skipIf(!hasGit)('git transport against a real empty remote', () => {
  it('reads an empty tree, then creates the branch with the first write', async () => {
    const env = { PATH: process.env.PATH ?? '' };
    const bare = tempDir('tps-bare-');
    const init = spawnSync('git', ['init', '--bare', '--initial-branch=main', bare], { encoding: 'utf8', env });
    expect(init.status).toBe(0);
    const transport = new GitTransport(createGitRunner(gitEnv(env)), gitConfig({ remote: `file://${bare}` }));

    expect(await transport.readText('PROJ-123', 'task.md')).toBeNull();
    expect(await transport.listDirectories('PROJ-123', 'stages')).toEqual([]);
    expect(await transport.locate('PROJ-123', '')).toBeNull();

    await transport.writeText('PROJ-123', 'task.md', '# task\n');
    expect(await transport.readText('PROJ-123', 'task.md')).toBe('# task\n');
    const shown = spawnSync('git', ['-C', bare, 'show', 'main:packets/PROJ-123/task.md'], { encoding: 'utf8', env });
    expect(shown.stdout).toBe('# task\n');
  });
});
