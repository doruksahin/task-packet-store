import { execFile, type ExecFileException } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GitConfig } from './config.js';
import { StoreError } from './errors.js';
import { FsTransport, type PacketTransport, type ResultLocation, type TransferFilter } from './transport.js';

/**
 * `git clone --branch` says this when the remote has no such branch: a read sees an empty tree and
 * the first write creates it. Case-sensitive, because `gitEnv` pins git's messages to English.
 */
const NO_BRANCH_YET = /Remote branch .* not found/;
/** `git commit` exits 1 when the copy changed nothing. Both wordings occur, on stdout or stderr. */
const NOTHING_TO_COMMIT = /nothing to commit|nothing added to commit/;

/** Point git at a repository other than the clone. An ambient one would commit and push elsewhere. */
const REDIRECTING_VARIABLES = new Set([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE',
  'GIT_PREFIX',
  'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
]);
/** `GIT_AUTHOR_*`/`GIT_COMMITTER_*` outrank `-c user.*`, and `GIT_CONFIG*` injects arbitrary configuration. */
const REDIRECTING_PREFIXES = ['GIT_AUTHOR_', 'GIT_COMMITTER_', 'GIT_CONFIG'];

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface GitRunner {
  run(args: string[], cwd?: string): Promise<GitResult>;
}

/**
 * The driver controls git's environment, as the rclone driver controls rclone's. The ambient
 * credential surface stays untouched — SSH agent, credential helper, `HOME`, `PATH`, `GIT_EXEC_PATH`
 * and everything else — because git's own credentials are the only ones this package uses. Removed
 * is what could redirect git away from its temporary clone (`GIT_DIR` and the rest of
 * `REDIRECTING_VARIABLES`) or override the fixed commit identity (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`,
 * `GIT_CONFIG*`). Added: no prompting over https, no prompting over ssh unless the operator set their
 * own command, and `LC_ALL=C` so the diagnostics this module matches stay the English strings.
 */
export function gitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean = Object.fromEntries(
    Object.entries(env).filter(
      ([key]) => !REDIRECTING_VARIABLES.has(key) && !REDIRECTING_PREFIXES.some((prefix) => key.startsWith(prefix)),
    ),
  );
  // GIT_TERMINAL_PROMPT never reaches ssh, which would still ask about an unknown host key or a
  // passphrase. BatchMode turns those into an error. An operator's own ssh command wins.
  const ssh = env.GIT_SSH_COMMAND === undefined && env.GIT_SSH === undefined
    ? { GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' }
    : {};
  return { ...clean, ...ssh, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
}

export function createGitRunner(env: NodeJS.ProcessEnv, binary = 'git'): GitRunner {
  return {
    run: (args, cwd) =>
      new Promise((resolve, reject) => {
        execFile(binary, args, { cwd, env, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          const out = String(stdout);
          const err = String(stderr);
          if (!error) {
            resolve({ code: 0, stdout: out, stderr: err });
            return;
          }
          const failure = error as ExecFileException;
          if (failure.code === 'ENOENT') {
            reject(new StoreError('STORE_GIT_UNAVAILABLE', `${binary} is not installed or not on PATH`));
            return;
          }
          // A killed child carries a signal and no exit status; a spawn failure such as EACCES
          // carries a string code. Neither has stderr, so the reason has to come from the error.
          if (failure.signal) {
            resolve({ code: 1, stdout: out, stderr: err || `git terminated by ${failure.signal}` });
            return;
          }
          const raw = Number(failure.code ?? 1);
          if (!Number.isFinite(raw)) {
            resolve({ code: 1, stdout: out, stderr: err || error.message });
            return;
          }
          resolve({ code: raw, stdout: out, stderr: err });
        });
      }),
  };
}

function lines(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
}

/**
 * git states the cause last: `clone` echoes `Cloning into '…'` before it fails, and `commit` writes
 * its diagnostics to stdout, so an empty stderr still has to produce a reason.
 */
function tail(result: GitResult): string {
  const stderr = lines(result.stderr);
  return stderr.length > 0 ? stderr.slice(-3).join(' | ') : lines(result.stdout).slice(-1).join(' | ');
}

function gitFailure(result: GitResult, what: string): StoreError {
  return new StoreError('STORE_GIT_FAILED', `${what} failed with exit ${result.code}: ${tail(result)}`);
}

function expectSuccess(result: GitResult, what: string): GitResult {
  if (result.code !== 0) throw gitFailure(result, what);
  return result;
}

/** The installed git, validated: a binary that cannot report its own version is a broken driver. */
export async function gitVersion(runner: GitRunner): Promise<string> {
  const { stdout } = expectSuccess(await runner.run(['--version']), 'git --version');
  const match = /^git version (\S+)/m.exec(stdout);
  if (!match) throw new StoreError('STORE_GIT_FAILED', 'cannot parse the output of git --version');
  return match[1];
}

/**
 * A temporary clone wrapped in git sync. Every read, copy, and path-safety rule belongs to the inner
 * `FsTransport` rooted at the clone; this layer only clones before and commits and pushes after a write.
 */
export class GitTransport implements PacketTransport {
  readonly driver = 'git' as const;

  constructor(
    private readonly runner: GitRunner,
    private readonly config: GitConfig,
  ) {}

  async locate(ticket: string, relativePath: string): Promise<ResultLocation | null> {
    return this.withClone(async (clone, inner) => {
      const found = await inner.locate(ticket, relativePath);
      if (!found) return null;
      // Something exists, so the clone has a commit. The location pins it: `git show <commit>:<path>`
      // resolves the same bytes in any clone of the remote, on any host.
      const commit = expectSuccess(await this.runner.run(['-C', clone, 'rev-parse', 'HEAD']), 'git rev-parse').stdout.trim();
      const posixPath = [this.config.prefix, ticket, relativePath].filter(Boolean).join('/');
      return { kind: found.kind, location: `${this.config.remote}#${commit}:${posixPath}` };
    });
  }

  async download(ticket: string, remoteDir: string, localDir: string, filter?: TransferFilter): Promise<void> {
    return this.withClone(async (_clone, inner) => {
      try {
        await inner.download(ticket, remoteDir, localDir, filter);
      } catch (error) {
        // The inner transport names a path inside the clone, which is deleted before a caller reads
        // the message. Name the remote instead; every other failure keeps its own message.
        if (error instanceof StoreError && error.code === 'STORE_PACKET_MISSING') {
          throw new StoreError('STORE_PACKET_MISSING', `${ticket}/${remoteDir} is not on ${this.config.remote}`);
        }
        throw error;
      }
    });
  }

  async upload(ticket: string, localDir: string, remoteDir: string, filter?: TransferFilter): Promise<void> {
    return this.withClone(async (clone, inner) => {
      await inner.upload(ticket, localDir, remoteDir, filter);
      await this.commitAndPush(clone, ticket, 'upload', remoteDir);
    });
  }

  async listDirectories(ticket: string, remoteDir: string): Promise<string[]> {
    return this.withClone((_clone, inner) => inner.listDirectories(ticket, remoteDir));
  }

  async readText(ticket: string, remoteFile: string): Promise<string | null> {
    return this.withClone((_clone, inner) => inner.readText(ticket, remoteFile));
  }

  async writeText(ticket: string, remoteFile: string, text: string): Promise<void> {
    return this.withClone(async (clone, inner) => {
      await inner.writeText(ticket, remoteFile, text);
      await this.commitAndPush(clone, ticket, 'writeText', remoteFile);
    });
  }

  /** One operation, one clone. The directory never outlives the operation. */
  private async withClone<T>(fn: (clone: string, inner: FsTransport) => Promise<T>): Promise<T> {
    const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'tps-git-'));
    try {
      await this.checkout(clone);
      const root = this.config.prefix ? path.join(clone, ...this.config.prefix.split('/')) : clone;
      return await fn(clone, new FsTransport(root));
    } finally {
      fs.rmSync(clone, { recursive: true, force: true });
    }
  }

  private async checkout(clone: string): Promise<void> {
    const { branch, remote } = this.config;
    const cloned = await this.runner.run([
      'clone', '--depth', '1', '--single-branch', '--branch', branch, '--no-tags', remote, clone,
    ]);
    if (cloned.code === 0) return;
    if (!NO_BRANCH_YET.test(cloned.stderr)) throw gitFailure(cloned, 'git clone');
    // `--initial-branch` needs git 2.28 (2020), which the package requires.
    expectSuccess(await this.runner.run(['init', `--initial-branch=${branch}`, clone]), 'git init');
    expectSuccess(await this.runner.run(['-C', clone, 'remote', 'add', 'origin', remote]), 'git remote add');
  }

  /** No retry, no rebase, no force: a rejected push is a real conflict for a person to resolve. */
  private async commitAndPush(clone: string, ticket: string, operation: string, remotePath: string): Promise<void> {
    const scope = [this.config.prefix, ticket].filter(Boolean).join('/');
    // A copy that selected no file leaves nothing to stage, and `git add` refuses an unmatched pathspec.
    if (!fs.existsSync(path.join(clone, ...scope.split('/')))) return;
    // The copy never deletes, so staging the ticket stages additions and modifications only.
    // `--force` because a `.gitignore` in the store repository, or the host's `core.excludesFile`,
    // would otherwise skip packet files and exit 0 — a silent partial write. The pathspec is still
    // only `<prefix?>/<ticket>`, so nothing outside this ticket can be staged.
    expectSuccess(await this.runner.run(['-C', clone, 'add', '--force', '--', scope]), 'git add');
    const committed = await this.runner.run([
      '-C', clone,
      '-c', 'user.name=task-packet-store',
      '-c', 'user.email=task-packet-store@localhost',
      '-c', 'commit.gpgsign=false',
      'commit', '-m', [operation, ticket, remotePath].filter(Boolean).join(' '),
    ]);
    if (committed.code === 1 && NOTHING_TO_COMMIT.test(`${committed.stdout}${committed.stderr}`)) return;
    expectSuccess(committed, 'git commit');
    expectSuccess(await this.runner.run(['-C', clone, 'push', 'origin', `HEAD:${this.config.branch}`]), 'git push');
  }
}
