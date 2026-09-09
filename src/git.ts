import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GitConfig } from './config.js';
import { StoreError } from './errors.js';
import { FsTransport, type PacketTransport, type ResultLocation, type TransferFilter } from './transport.js';

/** The remote has no commit yet, or not this branch: a read sees an empty tree and the first write creates it. */
const NO_BRANCH_YET = /Remote branch .* not found|cloned an empty repository|couldn't find remote ref/i;
/** `git commit` exits 1 when the copy changed nothing. Both wordings occur, on stdout or stderr. */
const NOTHING_TO_COMMIT = /nothing to commit|nothing added to commit/;

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface GitRunner {
  run(args: string[], cwd?: string): Promise<GitResult>;
}

/** The ambient environment unchanged: SSH agent, credential helpers, `HOME` and `GIT_*` all stay. Never prompt. */
export function gitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...env, GIT_TERMINAL_PROMPT: '0' };
}

export function createGitRunner(env: NodeJS.ProcessEnv, binary = 'git'): GitRunner {
  return {
    run: (args, cwd) =>
      new Promise((resolve, reject) => {
        execFile(binary, args, { cwd, env, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(new StoreError('STORE_GIT_UNAVAILABLE', `${binary} is not installed or not on PATH`));
            return;
          }
          const raw = error ? Number((error as { code?: unknown }).code ?? 1) : 0;
          resolve({ code: Number.isFinite(raw) ? raw : 1, stdout: String(stdout), stderr: String(stderr) });
        });
      }),
  };
}

/** git states the cause first; the remote echo and hints follow. */
function firstLine(stderr: string): string {
  return stderr.split('\n').map((line) => line.trim()).find((line) => line !== '') ?? '';
}

function gitFailure(result: GitResult, what: string): StoreError {
  return new StoreError('STORE_GIT_FAILED', `${what} failed with exit ${result.code}: ${firstLine(result.stderr)}`);
}

function expectSuccess(result: GitResult, what: string): GitResult {
  if (result.code !== 0) throw gitFailure(result, what);
  return result;
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
    return this.withClone((_clone, inner) => inner.download(ticket, remoteDir, localDir, filter));
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
    if ((await this.runner.run(['init', `--initial-branch=${branch}`, clone])).code !== 0) {
      expectSuccess(await this.runner.run(['init', clone]), 'git init');
      expectSuccess(await this.runner.run(['-C', clone, 'checkout', '--orphan', branch]), 'git checkout --orphan');
    }
    expectSuccess(await this.runner.run(['-C', clone, 'remote', 'add', 'origin', remote]), 'git remote add');
  }

  /** No retry, no rebase, no force: a rejected push is a real conflict for a person to resolve. */
  private async commitAndPush(clone: string, ticket: string, operation: string, remotePath: string): Promise<void> {
    const scope = [this.config.prefix, ticket].filter(Boolean).join('/');
    // A copy that selected no file leaves nothing to stage, and `git add` refuses an unmatched pathspec.
    if (!fs.existsSync(path.join(clone, ...scope.split('/')))) return;
    // The copy never deletes, so staging the ticket stages additions and modifications only.
    expectSuccess(await this.runner.run(['-C', clone, 'add', '--', scope]), 'git add');
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
