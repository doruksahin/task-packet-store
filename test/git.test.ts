import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseStoreConfig, type GitConfig } from '../src/config.js';
import { createGitRunner, GitTransport, gitEnv, gitVersion, type GitResult, type GitRunner } from '../src/git.js';
import { doctorStore } from '../src/store.js';
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

  it('keeps the credential surface and drops what redirects git or overrides its identity', () => {
    expect(
      gitEnv({
        PATH: '/usr/bin',
        HOME: '/home/agent',
        SSH_AUTH_SOCK: '/tmp/agent.sock',
        GIT_SSH_COMMAND: 'ssh -F /dev/null',
        GIT_DIR: '/caller/.git',
        GIT_WORK_TREE: '/caller',
        GIT_INDEX_FILE: '/caller/.git/index',
        GIT_AUTHOR_NAME: 'someone else',
        GIT_COMMITTER_EMAIL: 'someone-else@example.invalid',
        GIT_CONFIG_COUNT: '1',
        GIT_TEMPLATE_DIR: '/caller/.git-templates',
      }),
    ).toEqual({
      PATH: '/usr/bin',
      HOME: '/home/agent',
      SSH_AUTH_SOCK: '/tmp/agent.sock',
      GIT_SSH_COMMAND: 'ssh -F /dev/null',
      GIT_TERMINAL_PROMPT: '0',
      LC_ALL: 'C',
    });
  });

  it('reports the installed version and fails a git that cannot state one', async () => {
    expect(await gitVersion(fakeGit(() => ({ code: 0, stdout: 'git version 2.53.0\n', stderr: '' })))).toBe('2.53.0');
    await expect(gitVersion(fakeGit(() => ({ code: 127, stdout: '', stderr: 'dyld: missing library\n' })))).rejects.toThrow(
      'STORE_GIT_FAILED: git --version failed with exit 127: dyld: missing library',
    );
    await expect(gitVersion(fakeGit(() => ({ code: 0, stdout: '', stderr: '' })))).rejects.toThrow(
      'STORE_GIT_FAILED: cannot parse the output of git --version',
    );
  });

  it('leaves ssh configuration to the operator', () => {
    expect(gitEnv({ PATH: '/usr/bin' }).GIT_SSH_COMMAND).toBeUndefined();
    expect(gitEnv({ GIT_SSH_COMMAND: 'ssh -F /dev/null' }).GIT_SSH_COMMAND).toBe('ssh -F /dev/null');
  });
});

describe('doctorStore git arm', () => {
  it('fails gitVersion when git cannot report one', async () => {
    await expect(
      gitVersion(fakeGit(() => ({ code: 1, stdout: '', stderr: 'fatal: not a git repository\n' }))),
    ).rejects.toThrow('STORE_GIT_FAILED');
  });

  it.skipIf(!hasGit)('reports the git arm remoteRoot grammar with the installed git', async () => {
    const withPrefix = await doctorStore(gitConfig());
    expect(withPrefix.driver).toBe('git');
    expect(withPrefix.git).toMatch(/^\d+\.\d+/);
    expect(withPrefix.credential).toBe('ambient git credentials');
    expect(withPrefix.remoteRoot).toBe(`${REMOTE}#main:packets`);

    const withoutPrefix = await doctorStore(gitConfig({ prefix: undefined }));
    expect(withoutPrefix.remoteRoot).toBe(`${REMOTE}#main`);
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

  it('fails a rejected push with the last stderr lines and does not retry', async () => {
    const runner = fakeGit((args) =>
      args.includes('push')
        ? { code: 1, stdout: '', stderr: ' ! [rejected] HEAD -> main (fetch first)\nerror: failed to push some refs\n' }
        : undefined,
    );
    const upload = new GitTransport(runner, gitConfig()).upload('PROJ-123', sourceDir({ 'task.md': '# task\n' }), '');
    await expect(upload).rejects.toThrow(
      'STORE_GIT_FAILED: git push failed with exit 1: ! [rejected] HEAD -> main (fetch first) | error: failed to push some refs',
    );
    expect(runner.calls.filter((args) => args.includes('push'))).toHaveLength(1);
  });

  it('reports the cause of a clone that echoed its progress before failing', async () => {
    const runner = fakeGit((args) =>
      args[0] === 'clone'
        ? { code: 128, stdout: '', stderr: "Cloning into '/tmp/tps-git-x'...\nfatal: could not read Username for 'https://example.invalid'\n" }
        : undefined,
    );
    await expect(new GitTransport(runner, gitConfig()).readText('PROJ-123', 'task.md')).rejects.toThrow(
      "git clone failed with exit 128: Cloning into '/tmp/tps-git-x'... | fatal: could not read Username for 'https://example.invalid'",
    );
  });

  it('reports a commit failure whose diagnostics went to stdout', async () => {
    const runner = fakeGit((args) =>
      args.includes('commit')
        ? { code: 128, stdout: 'On branch main\nfatal: unable to write new index file\n', stderr: '' }
        : undefined,
    );
    const upload = new GitTransport(runner, gitConfig()).upload('PROJ-123', sourceDir({ 'task.md': '# task\n' }), '');
    await expect(upload).rejects.toThrow('git commit failed with exit 128: fatal: unable to write new index file');
  });

  it('stages the ticket with --force so an ignore rule cannot drop a packet file', async () => {
    const runner = fakeGit();
    await new GitTransport(runner, gitConfig()).writeText('PROJ-123', 'run.md', 'record\n');
    expect(runner.calls.find((args) => args.includes('add'))?.slice(2)).toEqual([
      'add', '--force', '--', 'packets/PROJ-123',
    ]);
  });

  it('names the remote, not the deleted clone, when a download finds no packet', async () => {
    const download = new GitTransport(fakeGit(), gitConfig()).download('PROJ-123', 'delivery', tempDir('tps-dest-'));
    await expect(download).rejects.toThrow(`STORE_PACKET_MISSING: PROJ-123/delivery is not on ${REMOTE}`);
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

/** The minimal fixture environment: no user configuration, and nothing the driver would strip. */
const PLAIN_ENV = { PATH: process.env.PATH ?? '' };
const FIXTURE_AUTHOR = ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', '-c', 'commit.gpgsign=false'];

function gitOk(args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8', env: PLAIN_ENV });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

/** A bare remote with `main` as its initial branch, addressed over `file://`. */
function bareRemote(): { bare: string; remote: string } {
  const bare = tempDir('tps-bare-');
  gitOk(['init', '--bare', '--initial-branch=main', bare]);
  return { bare, remote: `file://${bare}` };
}

function remoteFile(bare: string, relative: string): string | null {
  const shown = spawnSync('git', ['-C', bare, 'show', `main:${relative}`], { encoding: 'utf8', env: PLAIN_ENV });
  return shown.status === 0 ? shown.stdout : null;
}

describe.skipIf(!hasGit)('git transport against a real empty remote', () => {
  it('reads an empty tree, then creates the branch with the first write', async () => {
    const env = PLAIN_ENV;
    const { bare, remote } = bareRemote();
    const transport = new GitTransport(createGitRunner(gitEnv(env)), gitConfig({ remote }));

    expect(await transport.readText('PROJ-123', 'task.md')).toBeNull();
    expect(await transport.listDirectories('PROJ-123', 'stages')).toEqual([]);
    expect(await transport.locate('PROJ-123', '')).toBeNull();

    await transport.writeText('PROJ-123', 'task.md', '# task\n');
    expect(await transport.readText('PROJ-123', 'task.md')).toBe('# task\n');
    const shown = spawnSync('git', ['-C', bare, 'show', 'main:packets/PROJ-123/task.md'], { encoding: 'utf8', env });
    expect(shown.stdout).toBe('# task\n');
  });

  it('pushes a packet file that the host ignore rules match', async () => {
    // `git add` without `--force` skips an ignored path and still exits 0, so the file would be
    // missing from the remote with no failure anywhere.
    const home = tempDir('tps-home-');
    writeTree(home, { '.config/git/ignore': '*.log\n' });
    const { bare, remote } = bareRemote();
    const transport = new GitTransport(createGitRunner(gitEnv({ ...PLAIN_ENV, HOME: home })), gitConfig({ remote }));

    await transport.upload('PROJ-123', sourceDir({ 'a.log': 'log bytes\n', 'task.md': '# task\n' }), '');

    expect(remoteFile(bare, 'packets/PROJ-123/a.log')).toBe('log bytes\n');
    expect(remoteFile(bare, 'packets/PROJ-123/task.md')).toBe('# task\n');
  });

  it('writes to the configured remote even when the caller exported GIT_DIR', async () => {
    const caller = tempDir('tps-caller-');
    gitOk(['init', '--initial-branch=main', caller]);
    writeTree(caller, { 'unrelated.md': 'the caller repository\n' });
    gitOk(['-C', caller, 'add', '--', 'unrelated.md']);
    gitOk(['-C', caller, ...FIXTURE_AUTHOR, 'commit', '-m', 'initial']);
    const head = gitOk(['-C', caller, 'rev-parse', 'HEAD']).trim();
    const { bare, remote } = bareRemote();
    const env = { ...PLAIN_ENV, GIT_DIR: path.join(caller, '.git') };
    const transport = new GitTransport(createGitRunner(gitEnv(env)), gitConfig({ remote }));

    await transport.upload('PROJ-123', sourceDir({ 'task.md': '# task\n' }), '');

    expect(remoteFile(bare, 'packets/PROJ-123/task.md')).toBe('# task\n');
    expect(gitOk(['-C', caller, 'rev-parse', 'HEAD']).trim()).toBe(head);
    expect(gitOk(['-C', caller, 'rev-list', '--count', 'HEAD']).trim()).toBe('1');
    expect(gitOk(['-C', caller, 'status', '--porcelain'])).toBe('');
  });
});
