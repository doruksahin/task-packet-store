---
status: pending
step: 04
title: Config, identity, fs transport, fetch, push
---

# Step 04. Config, identity, fs transport, fetch, push

## Goal

`task-packet-store fetch` and `push` work with the `fs` driver. The identity digest ignores runs.
Every operation is written against `PacketTransport`, so step 05 adds rclone without touching them.

## Depends on

Step 03.

## Files

- Create: `src/errors.ts`, `src/config.ts`, `src/glob.ts`, `src/identity.ts`, `src/transport.ts`,
  `src/operations.ts`, `src/index.ts`
- Modify: `src/cli.ts` (wire `fetch` and `push`)
- Test: `test/config.test.ts`, `test/glob.test.ts`, `test/identity.test.ts`,
  `test/operations.shared.ts`, `test/operations.fs.test.ts`

Work test-first for each task. Run `pnpm vitest run <file>` after each step. Commit when green.

## Task 1: errors and config

**Test** `test/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_IDENTITY, parseStoreConfig, validateStage, validateTicket } from '../src/config.js';

describe('store config', () => {
  it('accepts an fs config and fills the default identity', () => {
    const config = parseStoreConfig({ driver: 'fs', root: '/abs/packets' });
    expect(config.identity).toEqual([...DEFAULT_IDENTITY]);
  });
  it('accepts a gdrive config', () => {
    const config = parseStoreConfig({ driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP', prefix: 'packets' });
    expect(config.driver).toBe('gdrive');
  });
  it('rejects unknown keys, relative roots, and bad prefixes', () => {
    expect(() => parseStoreConfig({ driver: 'fs', root: '/abs', extra: 1 })).toThrow('STORE_CONFIG_INVALID');
    expect(() => parseStoreConfig({ driver: 'fs', root: 'relative' })).toThrow('STORE_CONFIG_INVALID');
    expect(() => parseStoreConfig({ driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP', prefix: '/x/' })).toThrow('STORE_CONFIG_INVALID');
  });
  it('validates tickets and stages', () => {
    expect(validateTicket('ATT-5387')).toBe('ATT-5387');
    expect(() => validateTicket('att-1')).toThrow('STORE_CONFIG_INVALID');
    expect(validateStage('20-ac-walkthrough')).toBe('20-ac-walkthrough');
    expect(() => validateStage('walkthrough')).toThrow('STORE_CONFIG_INVALID');
  });
});
```

**Implementation** `src/errors.ts`:

```ts
export type StoreErrorCode =
  | 'STORE_CONFIG_INVALID'
  | 'STORE_STATE_INVALID'
  | 'STORE_AUTH_MISSING'
  | 'STORE_RCLONE_UNAVAILABLE'
  | 'STORE_RCLONE_FAILED'
  | 'STORE_PACKET_MISSING'
  | 'STORE_PACKET_UNSAFE'
  | 'STORE_DESTINATION_EXISTS'
  | 'STORE_RUN_MISSING'
  | 'STORE_VERSION_CONFLICT';

export class StoreError extends Error {
  readonly code: StoreErrorCode;

  constructor(code: StoreErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'StoreError';
    this.code = code;
  }
}

/** Exit 2 for caller mistakes, exit 1 for everything else. */
export function exitCodeFor(error: unknown): number {
  if (error instanceof StoreError) {
    return error.code === 'STORE_CONFIG_INVALID' || error.code === 'STORE_STATE_INVALID' ? 2 : 1;
  }
  return 1;
}
```

`src/config.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { StoreError } from './errors.js';

export const SAFE_TICKET = /^[A-Z][A-Z0-9]+-\d+$/;
export const SAFE_STAGE = /^\d{2}-[a-z][a-z0-9-]*$/;
export const SAFE_PREFIX = /^[A-Za-z0-9](?:[A-Za-z0-9._/-]*[A-Za-z0-9])?$/;
export const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
/** Anchored glob. Tool output lives here and is never part of fetch or push. */
export const RUNS_GLOB = '/stages/*/runs/**';
export const DEFAULT_IDENTITY = ['00 Packet.md', 'task.md', 'jira/**'] as const;

const IdentityEntry = z
  .string()
  .regex(/^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[^\\\0]+$/, 'identity entry must be a relative path');
const identity = z.array(IdentityEntry).min(1).default([...DEFAULT_IDENTITY]);

export const StoreConfigSchema = z.discriminatedUnion('driver', [
  z.strictObject({
    driver: z.literal('fs'),
    root: z.string().refine((value) => path.isAbsolute(value), 'root must be an absolute path'),
    identity,
  }),
  z.strictObject({
    driver: z.literal('gdrive'),
    sharedDriveId: z.string().regex(DRIVE_ID, 'sharedDriveId must be a Drive id'),
    prefix: z.string().regex(SAFE_PREFIX, 'prefix has no leading or trailing slash').optional(),
    identity,
  }),
]);

export type StoreConfig = z.infer<typeof StoreConfigSchema>;
export type FsConfig = Extract<StoreConfig, { driver: 'fs' }>;
export type GdriveConfig = Extract<StoreConfig, { driver: 'gdrive' }>;

export function parseStoreConfig(value: unknown): StoreConfig {
  const result = StoreConfigSchema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
    throw new StoreError('STORE_CONFIG_INVALID', detail.join('; '));
  }
  return result.data;
}

export function readStoreConfig(file: string): StoreConfig {
  if (!path.isAbsolute(file)) throw new StoreError('STORE_CONFIG_INVALID', '--store must be an absolute path');
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new StoreError('STORE_CONFIG_INVALID', `cannot read ${file}: ${(error as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new StoreError('STORE_CONFIG_INVALID', `${file} is not JSON`);
  }
  return parseStoreConfig(json);
}

export function validateTicket(ticket: string): string {
  if (!SAFE_TICKET.test(ticket)) throw new StoreError('STORE_CONFIG_INVALID', `invalid ticket: ${ticket}`);
  return ticket;
}

export function validateStage(stage: string): string {
  if (!SAFE_STAGE.test(stage)) throw new StoreError('STORE_CONFIG_INVALID', `invalid stage: ${stage}`);
  return stage;
}
```

Commit: `feat: add store config schema and error codes`

## Task 2: anchored glob matcher

The `fs` transport needs the same filter semantics that rclone applies to anchored patterns.
Patterns start with `/`. `*` matches one path segment. `**` matches zero or more segments.

**Test** `test/glob.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchesAny, matchesGlob } from '../src/glob.js';

describe('anchored glob', () => {
  it('matches runs below any stage', () => {
    expect(matchesGlob('/stages/*/runs/**', 'stages/20-ac-walkthrough/runs/v1/run.md')).toBe(true);
    expect(matchesGlob('/stages/*/runs/**', 'stages/20-ac-walkthrough/README.md')).toBe(false);
    expect(matchesGlob('/stages/*/runs/**', 'other/stages/x/runs/y')).toBe(false);
  });
  it('matches relative to the given root', () => {
    expect(matchesGlob('/*/runs/**', '20-ac-walkthrough/runs/v1/input/notes.md')).toBe(true);
    expect(matchesGlob('/run.md', 'run.md')).toBe(true);
    expect(matchesGlob('/run.md', 'input/run.md')).toBe(false);
  });
  it('requires anchored patterns', () => {
    expect(() => matchesGlob('stages/**', 'stages/x')).toThrow('anchored');
    expect(matchesAny(undefined, 'a')).toBe(false);
  });
});
```

**Implementation** `src/glob.ts`:

```ts
/** Anchored glob: the pattern starts with "/", "*" matches one segment, "**" matches zero or more. */
export function matchesGlob(pattern: string, relativePath: string): boolean {
  if (!pattern.startsWith('/')) throw new Error(`glob must be anchored with "/": ${pattern}`);
  return match(pattern.slice(1).split('/'), relativePath.split('/'));
}

function match(pattern: string[], segments: string[]): boolean {
  if (pattern.length === 0) return segments.length === 0;
  const [head, ...rest] = pattern;
  if (head === '**') return match(rest, segments) || (segments.length > 0 && match(pattern, segments.slice(1)));
  if (segments.length === 0) return false;
  if (head === '*' || head === segments[0]) return match(rest, segments.slice(1));
  return false;
}

export function matchesAny(patterns: readonly string[] | undefined, relativePath: string): boolean {
  return (patterns ?? []).some((pattern) => matchesGlob(pattern, relativePath));
}
```

Commit: `feat: add anchored glob matcher for fs filters`

## Task 3: identity digest

**Test** `test/identity.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_IDENTITY } from '../src/config.js';
import { packetSha256 } from '../src/identity.js';

function write(root: string, tree: Record<string, string>): void {
  for (const [relative, text] of Object.entries(tree)) {
    const file = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}

describe('packetSha256', () => {
  it('changes with identity files and ignores runs and human stage files', () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'tps-a-'));
    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'tps-b-'));
    const identity = { '00 Packet.md': '# p\n', 'task.md': '# t\n', 'jira/00 Issue.md': '# i\n' };
    write(a, { ...identity, 'stages/20-ac-walkthrough/README.md': 'one\n' });
    write(b, { ...identity, 'stages/20-ac-walkthrough/README.md': 'two\n', 'stages/20-ac-walkthrough/runs/v1/run.md': 'x\n' });
    expect(packetSha256(a, DEFAULT_IDENTITY)).toBe(packetSha256(b, DEFAULT_IDENTITY));
    write(b, { 'jira/00 Issue.md': '# changed\n' });
    expect(packetSha256(a, DEFAULT_IDENTITY)).not.toBe(packetSha256(b, DEFAULT_IDENTITY));
  });
  it('fails when no identity file exists', () => {
    const c = fs.mkdtempSync(path.join(os.tmpdir(), 'tps-c-'));
    write(c, { 'stages/x/README.md': 'x\n' });
    expect(() => packetSha256(c, DEFAULT_IDENTITY)).toThrow('STORE_PACKET_MISSING');
  });
});
```

**Implementation** `src/identity.ts`. The formula is the walkthrough's `run-history.ts` formula. Only
the file subset differs.

```ts
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { StoreError } from './errors.js';

export interface PacketFile {
  path: string;
  size: number;
  sha256: string;
}

export function sha256(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function byteCompare(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

/** Every regular file under root, as POSIX-relative paths sorted by path bytes. Non-regular entries fail. */
export function regularFiles(root: string, directory: string = root): PacketFile[] {
  const files: PacketFile[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...regularFiles(root, absolute));
      continue;
    }
    if (!entry.isFile()) throw new StoreError('STORE_PACKET_UNSAFE', `non-regular entry: ${absolute}`);
    const bytes = fs.readFileSync(absolute);
    files.push({ path: path.relative(root, absolute).split(path.sep).join('/'), size: bytes.length, sha256: sha256(bytes) });
  }
  return files.sort((left, right) => byteCompare(left.path, right.path));
}

/** An identity entry is an exact file or `dir/**`. */
export function matchesIdentity(relativePath: string, identity: readonly string[]): boolean {
  return identity.some((entry) => (entry.endsWith('/**') ? relativePath.startsWith(entry.slice(0, -2)) : relativePath === entry));
}

/** Packet identity: SHA-256 of the sorted per-file manifest of identity files. */
export function packetSha256(root: string, identity: readonly string[]): string {
  const files = regularFiles(root).filter((file) => matchesIdentity(file.path, identity));
  if (files.length === 0) throw new StoreError('STORE_PACKET_MISSING', `no identity files under ${root}`);
  return sha256(JSON.stringify(files));
}
```

Commit: `feat: digest packet identity over the identity zone only`

## Task 4: transport interface and FsTransport

**Implementation** `src/transport.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { StoreError } from './errors.js';
import { matchesAny } from './glob.js';

export interface TransferFilter {
  includes?: readonly string[];
  excludes?: readonly string[];
}

export type Driver = 'fs' | 'gdrive';

export interface PacketTransport {
  readonly driver: Driver;
  /** Copy files below <ticket>/<remoteDir> into localDir. Merges. Never deletes. */
  download(ticket: string, remoteDir: string, localDir: string, filter?: TransferFilter): Promise<void>;
  /** Copy files below localDir into <ticket>/<remoteDir>. Merges. Never deletes. */
  upload(ticket: string, localDir: string, remoteDir: string, filter?: TransferFilter): Promise<void>;
  /** Names of directories directly below <ticket>/<remoteDir>. Empty when the directory is absent. */
  listDirectories(ticket: string, remoteDir: string): Promise<string[]>;
  /** UTF-8 text of <ticket>/<remoteFile>, or null when absent. */
  readText(ticket: string, remoteFile: string): Promise<string | null>;
  /** Replace <ticket>/<remoteFile> with text. Creates parent directories. */
  writeText(ticket: string, remoteFile: string, text: string): Promise<void>;
}

/** rclone treats include plus exclude differently across versions. The package refuses the mix. */
export function assertFilter(filter: TransferFilter | undefined): TransferFilter {
  const value = filter ?? {};
  if (value.includes?.length && value.excludes?.length) {
    throw new StoreError('STORE_CONFIG_INVALID', 'a filter has includes or excludes, never both');
  }
  return value;
}

export function selected(relativePath: string, filter: TransferFilter): boolean {
  if (filter.includes?.length) return matchesAny(filter.includes, relativePath);
  return !matchesAny(filter.excludes, relativePath);
}

function walk(root: string, directory: string = root): string[] {
  if (!fs.existsSync(directory)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(root, absolute));
    else if (entry.isFile()) out.push(path.relative(root, absolute).split(path.sep).join('/'));
    else throw new StoreError('STORE_PACKET_UNSAFE', `non-regular entry: ${absolute}`);
  }
  return out;
}

function copyTree(from: string, to: string, filter: TransferFilter): void {
  for (const relative of walk(from)) {
    if (!selected(relative, filter)) continue;
    const target = path.join(to, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(from, ...relative.split('/')), target);
  }
}

export class FsTransport implements PacketTransport {
  readonly driver = 'fs' as const;

  constructor(private readonly root: string) {}

  private at(ticket: string, relative: string): string {
    return path.join(this.root, ticket, ...relative.split('/').filter(Boolean));
  }

  async download(ticket: string, remoteDir: string, localDir: string, filter?: TransferFilter): Promise<void> {
    const source = this.at(ticket, remoteDir);
    if (!fs.existsSync(source)) throw new StoreError('STORE_PACKET_MISSING', `${source} does not exist`);
    copyTree(source, localDir, assertFilter(filter));
  }

  async upload(ticket: string, localDir: string, remoteDir: string, filter?: TransferFilter): Promise<void> {
    copyTree(localDir, this.at(ticket, remoteDir), assertFilter(filter));
  }

  async listDirectories(ticket: string, remoteDir: string): Promise<string[]> {
    const directory = this.at(ticket, remoteDir);
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  }

  async readText(ticket: string, remoteFile: string): Promise<string | null> {
    const file = this.at(ticket, remoteFile);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  }

  async writeText(ticket: string, remoteFile: string, text: string): Promise<void> {
    const file = this.at(ticket, remoteFile);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf8');
  }
}
```

Tests for this class come through the operations suite in Task 5.

Commit: `feat: add PacketTransport and the fs transport`

## Task 5: fetch and push operations

**Shared test helpers** `test/operations.shared.ts`. Step 05 runs the same suite through rclone.

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import type { StoreConfig } from '../src/config.js';
import { fetchPacket, pushPacket } from '../src/operations.js';
import type { PacketTransport } from '../src/transport.js';

export const PACKET: Record<string, string> = {
  '00 Packet.md': '# packet\n',
  'task.md': '# task\n',
  'jira/00 Issue.md': '# issue\n',
  'jira/attachments/spec.txt': 'spec bytes\n',
  'stages/20-ac-walkthrough/README.md': '# stage\n',
  'stages/20-ac-walkthrough/runs/v1/run.md': 'stale run\n',
};

export function writeTree(root: string, tree: Record<string, string>): void {
  for (const [relative, text] of Object.entries(tree)) {
    const file = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}

export function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export interface Harness {
  transport: PacketTransport;
  config: StoreConfig;
  /** Put a packet into the store as if it were already there. */
  seed(ticket: string, tree: Record<string, string>): void;
  /** Read one file from the store, or null. */
  remoteFile(ticket: string, relative: string): string | null;
}

export function exerciseFetchAndPush(make: () => Harness): void {
  it('fetch excludes runs, freezes files, and digests the identity zone', async () => {
    const h = make();
    h.seed('ATT-1234', PACKET);
    const result = await fetchPacket(h.transport, h.config, 'ATT-1234', tempDir('tps-dest-'));
    expect(result.fileCount).toBe(5);
    expect(fs.existsSync(path.join(result.packetDirectory, 'stages/20-ac-walkthrough/runs'))).toBe(false);
    expect(fs.statSync(path.join(result.packetDirectory, 'task.md')).mode & 0o222).toBe(0);
    expect(result.packetSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fetch refuses an existing destination and leaves no partial directory on failure', async () => {
    const h = make();
    h.seed('ATT-1234', PACKET);
    const destination = tempDir('tps-dest-');
    fs.mkdirSync(path.join(destination, 'ATT-1234'));
    await expect(fetchPacket(h.transport, h.config, 'ATT-1234', destination)).rejects.toThrow('STORE_DESTINATION_EXISTS');
    await expect(fetchPacket(h.transport, h.config, 'ATT-9999', destination)).rejects.toThrow('STORE_PACKET_MISSING');
    expect(fs.readdirSync(destination)).toEqual(['ATT-1234']);
  });

  it('push uploads without runs and a later fetch returns the same digest', async () => {
    const h = make();
    const local = path.join(tempDir('tps-local-'), 'ATT-4321');
    writeTree(local, PACKET);
    await pushPacket(h.transport, h.config, 'ATT-4321', local);
    expect(h.remoteFile('ATT-4321', 'stages/20-ac-walkthrough/runs/v1/run.md')).toBeNull();
    expect(h.remoteFile('ATT-4321', 'jira/00 Issue.md')).toBe('# issue\n');
    const fetched = await fetchPacket(h.transport, h.config, 'ATT-4321', tempDir('tps-dest-'));
    expect(fetched.fileCount).toBe(5);
  });
}
```

**fs suite** `test/operations.fs.test.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { FsTransport } from '../src/transport.js';
import { exerciseFetchAndPush, tempDir, writeTree, type Harness } from './operations.shared.js';

function makeFsHarness(): Harness {
  const root = tempDir('tps-store-');
  return {
    transport: new FsTransport(root),
    config: parseStoreConfig({ driver: 'fs', root }),
    seed: (ticket, tree) => writeTree(path.join(root, ticket), tree),
    remoteFile: (ticket, relative) => {
      const file = path.join(root, ticket, ...relative.split('/'));
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    },
  };
}

describe('operations through FsTransport', () => {
  exerciseFetchAndPush(makeFsHarness);
});
```

Run: expected FAIL, `../src/operations.js` does not exist.

**Implementation** `src/operations.ts`:

```ts
import fs from 'node:fs';
import path from 'node:path';
import { RUNS_GLOB, type StoreConfig, validateTicket } from './config.js';
import { StoreError } from './errors.js';
import { packetSha256, regularFiles } from './identity.js';
import type { PacketTransport } from './transport.js';

const SAFE_SEGMENT = /^(?!\.{1,2}$)[^/\\\0]+$/;

export function assertAbsolute(value: string, label: string): string {
  if (!path.isAbsolute(value)) throw new StoreError('STORE_CONFIG_INVALID', `${label} must be an absolute path`);
  return path.resolve(value);
}

function assertSafeTree(root: string): number {
  const files = regularFiles(root);
  for (const file of files) {
    for (const segment of file.path.split('/')) {
      if (!SAFE_SEGMENT.test(segment)) throw new StoreError('STORE_PACKET_UNSAFE', `unsafe path: ${file.path}`);
    }
  }
  return files.length;
}

function freeze(root: string): void {
  for (const file of regularFiles(root)) fs.chmodSync(path.join(root, ...file.path.split('/')), 0o444);
}

export interface FetchResult {
  ticket: string;
  packetDirectory: string;
  fileCount: number;
  packetSha256: string;
  driver: string;
}

export async function fetchPacket(
  transport: PacketTransport,
  config: StoreConfig,
  ticket: string,
  destination: string,
): Promise<FetchResult> {
  validateTicket(ticket);
  const parent = assertAbsolute(destination, '--destination');
  const final = path.join(parent, ticket);
  if (fs.existsSync(final)) throw new StoreError('STORE_DESTINATION_EXISTS', `${final} already exists`);
  fs.mkdirSync(parent, { recursive: true });
  const temp = fs.mkdtempSync(path.join(parent, `.${ticket}.partial-`));
  try {
    await transport.download(ticket, '', temp, { excludes: [RUNS_GLOB] });
    const fileCount = assertSafeTree(temp);
    if (fileCount === 0) throw new StoreError('STORE_PACKET_MISSING', `no files for ${ticket}`);
    const digest = packetSha256(temp, config.identity);
    freeze(temp);
    fs.renameSync(temp, final);
    return { ticket, packetDirectory: final, fileCount, packetSha256: digest, driver: transport.driver };
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

export interface PushResult {
  ticket: string;
  driver: string;
  from: string;
}

export async function pushPacket(
  transport: PacketTransport,
  config: StoreConfig,
  ticket: string,
  from: string,
): Promise<PushResult> {
  validateTicket(ticket);
  const source = assertAbsolute(from, '--from');
  if (!fs.existsSync(source)) throw new StoreError('STORE_PACKET_MISSING', `${source} does not exist`);
  if (config.driver === 'fs' && path.resolve(config.root, ticket) === source) {
    throw new StoreError('STORE_CONFIG_INVALID', '--from is already the store location for this ticket');
  }
  packetSha256(source, config.identity);
  await transport.upload(ticket, source, '', { excludes: [RUNS_GLOB] });
  return { ticket, driver: transport.driver, from: source };
}
```

Run: expected PASS.

Commit: `feat: fetch and push packets through a transport`

## Task 6: wire the CLI

Modify `src/cli.ts`. Replace the `fetch` and `push` placeholders. Keep the others.

```ts
import fs from 'node:fs';
import { readStoreConfig } from './config.js';
import { exitCodeFor } from './errors.js';
import { fetchPacket, pushPacket } from './operations.js';
import { createTransport } from './store.js';

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function run(action: () => Promise<unknown>): Promise<void> {
  try {
    emit(await action());
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = exitCodeFor(error);
  }
}

program
  .command('fetch')
  .description('Download one frozen packet without runs into <destination>/<TICKET>.')
  .requiredOption('--store <file>', 'absolute path to the store JSON')
  .requiredOption('--ticket <ticket>', 'Jira ticket, for example PROJ-123')
  .requiredOption('--destination <dir>', 'absolute directory that receives <TICKET>')
  .action((options) =>
    run(async () => {
      const config = readStoreConfig(options.store);
      return fetchPacket(createTransport(config), config, options.ticket, options.destination);
    }),
  );

program
  .command('push')
  .description('Upload one packet from a local directory, without runs.')
  .requiredOption('--store <file>', 'absolute path to the store JSON')
  .requiredOption('--ticket <ticket>', 'Jira ticket')
  .requiredOption('--from <dir>', 'absolute local packet directory')
  .action((options) =>
    run(async () => {
      const config = readStoreConfig(options.store);
      return pushPacket(createTransport(config), config, options.ticket, options.from);
    }),
  );
```

Create `src/store.ts` with the `fs` arm only. Step 05 adds the `gdrive` arm.

```ts
import type { StoreConfig } from './config.js';
import { StoreError } from './errors.js';
import { FsTransport, type PacketTransport } from './transport.js';

export function createTransport(config: StoreConfig, env: NodeJS.ProcessEnv = process.env): PacketTransport {
  if (config.driver === 'fs') return new FsTransport(config.root);
  throw new StoreError('STORE_CONFIG_INVALID', `driver ${config.driver} arrives in step 05`);
}
```

Create `src/index.ts` exporting the public surface: `packetSha256`, `DEFAULT_IDENTITY`,
`parseStoreConfig`, `readStoreConfig`, `StoreError`, and the types.

Re-add a library-import smoke to `scripts/smoke-installed-artifact.mjs`:
`import('@doruksahin/task-packet-store')` from the installed tarball and assert `packetSha256` is a
function, because step 09 imports it from the installed package.

Commit: `feat: expose fetch and push on the CLI`

## Done when

```bash
pnpm check
store=$(mktemp -d); mkdir -p "$store/ATT-1/jira"; echo '# p' > "$store/ATT-1/00 Packet.md"; echo '# t' > "$store/ATT-1/task.md"; echo '# i' > "$store/ATT-1/jira/00 Issue.md"
cfg=$(mktemp); printf '{"driver":"fs","root":"%s"}\n' "$store" > "$cfg"
node dist/cli.js fetch --store "$cfg" --ticket ATT-1 --destination "$(mktemp -d)"
```

Expected: all tests pass. The last command prints one JSON line with `fileCount` 3 and a 64-hex
`packetSha256`, exit 0.

## Evidence

```text
```

## Rollback

Revert the commits of this step. Step 03 remains valid.
