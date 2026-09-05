import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { IGNORED_BASENAMES, validateLocationPath, validateTicket, type GdriveConfig } from './config.js';
import { StoreError } from './errors.js';
import { assertFilter, type PacketTransport, type ResultLocation, type TransferFilter } from './transport.js';

export const RCLONE_TESTED_VERSION = '1.75.0';
/** rclone exit code 3 is "directory not found", 4 is "file not found". */
const NOT_FOUND = new Set([3, 4]);

export interface RcloneResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RcloneRunner {
  run(args: string[]): Promise<RcloneResult>;
}

/** Map the package's credential variables onto rclone's and drop every ambient RCLONE_ variable. */
export function rcloneEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const credentials = env.PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS;
  const token = env.PACKET_STORE_DRIVE_TOKEN;
  if (Boolean(credentials) === Boolean(token)) {
    throw new StoreError(
      'STORE_AUTH_MISSING',
      'set exactly one of PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS or PACKET_STORE_DRIVE_TOKEN',
    );
  }
  const clean = Object.fromEntries(
    Object.entries(env).filter(([key]) => !key.startsWith('RCLONE_') && !key.startsWith('PACKET_STORE_DRIVE_')),
  );
  return {
    ...clean,
    RCLONE_DRIVE_SCOPE: 'drive',
    ...(credentials ? { RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS: credentials } : { RCLONE_DRIVE_TOKEN: token }),
  };
}

export function driveRemote(config: GdriveConfig, ticket: string): string {
  const root = driveRoot(config);
  return config.prefix ? `${root}/${ticket}` : `${root}${ticket}`;
}

export function driveRoot(config: GdriveConfig): string {
  return `:drive,team_drive=${config.sharedDriveId}:${config.prefix ?? ''}`;
}

export function createRcloneRunner(env: NodeJS.ProcessEnv, binary = 'rclone'): RcloneRunner {
  return {
    run: (args) =>
      new Promise((resolve, reject) => {
        execFile(binary, args, { env, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            reject(new StoreError('STORE_RCLONE_UNAVAILABLE', `${binary} is not installed or not on PATH`));
            return;
          }
          const raw = error ? Number((error as { code?: unknown }).code ?? 1) : 0;
          resolve({ code: Number.isFinite(raw) ? raw : 1, stdout: String(stdout), stderr: String(stderr) });
        });
      }),
  };
}

function expectSuccess(result: RcloneResult, what: string): RcloneResult {
  if (result.code !== 0) {
    const tail = result.stderr.trim().split('\n').slice(-3).join(' | ');
    throw new StoreError('STORE_RCLONE_FAILED', `${what} failed with exit ${result.code}: ${tail}`);
  }
  return result;
}

export async function rcloneVersion(runner: RcloneRunner): Promise<string> {
  const { stdout } = expectSuccess(await runner.run(['version']), 'rclone version');
  const match = /^rclone v(\S+)/m.exec(stdout);
  if (!match) throw new StoreError('STORE_RCLONE_FAILED', 'cannot parse the output of rclone version');
  return match[1];
}

function filterArgs(filter?: TransferFilter): string[] {
  assertFilter(filter);
  const ignored = [...IGNORED_BASENAMES].flatMap((name) => [`/${name}`, `/**/${name}`]);
  if (filter?.includes !== undefined) {
    const rules = [
      ...ignored.map((pattern) => `- ${pattern}`),
      ...filter.includes.map((pattern) => `+ ${pattern}`),
      '- **',
    ];
    return rules.flatMap((rule) => ['--filter', rule]);
  }
  const excludes = [...(filter?.excludes ?? []), ...ignored];
  return excludes.flatMap((pattern) => ['--exclude', pattern]);
}

function join(remote: string, relative: string): string {
  return relative ? `${remote}/${relative}` : remote;
}

interface Listed {
  Name: string;
  IsDir: boolean;
}

export class RcloneTransport implements PacketTransport {
  readonly driver = 'gdrive' as const;

  constructor(
    private readonly rclone: RcloneRunner,
    private readonly remoteFor: (ticket: string) => string,
  ) {}

  async locate(ticket: string, relativePath: string): Promise<ResultLocation | null> {
    validateTicket(ticket);
    validateLocationPath(relativePath);
    const remote = this.remoteFor(ticket);
    const segments = relativePath.split('/');
    const name = relativePath ? segments.pop()! : ticket;
    // remoteFor addresses <root>/<ticket> (or :drive,...:<ticket> without a prefix).
    const parent = relativePath ? join(remote, segments.join('/')) : remote.slice(0, -ticket.length);
    const result = await this.rclone.run(['lsjson', parent]);
    if (NOT_FOUND.has(result.code)) return null;
    const { stdout } = expectSuccess(result, 'rclone lsjson (locate)');
    let entries: unknown;
    try {
      entries = JSON.parse(stdout);
    } catch {
      throw new StoreError('STORE_RCLONE_FAILED', 'rclone lsjson (locate) returned invalid JSON');
    }
    if (!Array.isArray(entries) || entries.some((entry) => !entry || typeof entry.Name !== 'string')) {
      throw new StoreError('STORE_RCLONE_FAILED', 'rclone lsjson (locate) returned invalid entries');
    }
    const matches = entries.filter((entry) => entry.Name === name);
    if (matches.length === 0) return null;
    if (matches.length !== 1) {
      throw new StoreError('STORE_RCLONE_FAILED', 'result location is ambiguous: duplicate object names');
    }
    const entry = matches[0];
    if (typeof entry.IsDir !== 'boolean' || typeof entry.ID !== 'string' || !/^[A-Za-z0-9_-]+$/.test(entry.ID)) {
      throw new StoreError('STORE_RCLONE_FAILED', 'result location has no valid object ID or type');
    }
    return {
      kind: entry.IsDir ? 'directory' : 'file',
      location: entry.IsDir
        ? `https://drive.google.com/drive/folders/${entry.ID}`
        : `https://drive.google.com/file/d/${entry.ID}/view`,
    };
  }

  async download(ticket: string, remoteDir: string, localDir: string, filter?: TransferFilter): Promise<void> {
    const source = join(this.remoteFor(ticket), remoteDir);
    const result = await this.rclone.run(['copy', source, localDir, '--checksum', ...filterArgs(filter)]);
    if (NOT_FOUND.has(result.code)) {
      throw new StoreError('STORE_PACKET_MISSING', `${ticket}/${remoteDir} is not on the remote`);
    }
    expectSuccess(result, 'rclone copy (download)');
  }

  async upload(ticket: string, localDir: string, remoteDir: string, filter?: TransferFilter): Promise<void> {
    const target = join(this.remoteFor(ticket), remoteDir);
    expectSuccess(
      await this.rclone.run(['copy', localDir, target, '--checksum', ...filterArgs(filter)]),
      'rclone copy (upload)',
    );
  }

  async listDirectories(ticket: string, remoteDir: string): Promise<string[]> {
    const result = await this.rclone.run(['lsjson', '--dirs-only', join(this.remoteFor(ticket), remoteDir)]);
    if (NOT_FOUND.has(result.code)) return [];
    const entries = JSON.parse(expectSuccess(result, 'rclone lsjson').stdout) as Listed[];
    return entries
      .filter((entry) => entry.IsDir)
      .map((entry) => entry.Name)
      .sort();
  }

  async readText(ticket: string, remoteFile: string): Promise<string | null> {
    const segments = remoteFile.split('/');
    const name = segments.pop();
    const listing = await this.rclone.run([
      'lsjson',
      '--files-only',
      join(this.remoteFor(ticket), segments.join('/')),
    ]);
    if (NOT_FOUND.has(listing.code)) return null;
    const entries = JSON.parse(expectSuccess(listing, 'rclone lsjson').stdout) as Listed[];
    if (!entries.some((entry) => entry.Name === name)) return null;
    return expectSuccess(await this.rclone.run(['cat', join(this.remoteFor(ticket), remoteFile)]), 'rclone cat').stdout;
  }

  async writeText(ticket: string, remoteFile: string, text: string): Promise<void> {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tps-write-'));
    try {
      const file = path.join(directory, 'file');
      fs.writeFileSync(file, text, 'utf8');
      expectSuccess(
        await this.rclone.run(['copyto', file, join(this.remoteFor(ticket), remoteFile)]),
        'rclone copyto',
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}
