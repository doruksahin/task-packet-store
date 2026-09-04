---
status: pending
step: 05
title: rclone transport, begin, checkpoint, pull, doctor
---

# Step 05. rclone transport, begin, checkpoint, pull, doctor

## Goal

The `gdrive` driver works through rclone. `begin`, `checkpoint`, and `pull` work through both
transports. The operations suite from step 04 passes through `RcloneTransport` against a local
directory. One manual round trip against the real Shared Drive succeeds.

## Depends on

Step 04. Step 02 for the manual round trip.

## Files

- Create: `src/rclone.ts`, `src/run-record.ts`
- Modify: `src/operations.ts`, `src/store.ts`, `src/cli.ts`, `src/index.ts`
- Test: `test/rclone.test.ts`, `test/run-record.test.ts`, `test/operations.shared.ts`,
  `test/operations.rclone.test.ts`

## Task 1: rclone env mapping and connection string

**Test** `test/rclone.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { driveRemote, rcloneEnv } from '../src/rclone.js';

describe('rclone env', () => {
  it('requires exactly one credential variable', () => {
    expect(() => rcloneEnv({})).toThrow('STORE_AUTH_MISSING');
    expect(() => rcloneEnv({ PACKET_STORE_DRIVE_TOKEN: 'a', PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS: 'b' })).toThrow('STORE_AUTH_MISSING');
  });
  it('maps the token, strips ambient RCLONE_ variables, and sets the scope', () => {
    const env = rcloneEnv({ PATH: '/bin', RCLONE_CONFIG: '/etc/rclone.conf', PACKET_STORE_DRIVE_TOKEN: '{"t":1}' });
    expect(env).toEqual({ PATH: '/bin', RCLONE_DRIVE_SCOPE: 'drive', RCLONE_DRIVE_TOKEN: '{"t":1}' });
  });
  it('maps the service account inline', () => {
    const env = rcloneEnv({ PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS: '{"type":"service_account"}' });
    expect(env.RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS).toBe('{"type":"service_account"}');
    expect(env.PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS).toBeUndefined();
  });
});

describe('driveRemote', () => {
  it('builds a connection string with and without prefix', () => {
    const withPrefix = parseStoreConfig({ driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP', prefix: 'packets' });
    const bare = parseStoreConfig({ driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP' });
    if (withPrefix.driver !== 'gdrive' || bare.driver !== 'gdrive') throw new Error('unreachable');
    expect(driveRemote(withPrefix, 'ATT-1')).toBe(':drive,team_drive=0ABcDeFgHiJkLmNoP:packets/ATT-1');
    expect(driveRemote(bare, 'ATT-1')).toBe(':drive,team_drive=0ABcDeFgHiJkLmNoP:ATT-1');
  });
});
```

**Implementation** `src/rclone.ts`:

```ts
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GdriveConfig } from './config.js';
import { StoreError } from './errors.js';
import { assertFilter, type PacketTransport, type TransferFilter } from './transport.js';

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

/** Map the package's two credential variables onto rclone's, and drop every ambient RCLONE_ variable. */
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
  const base = config.prefix ? `${config.prefix}/${ticket}` : ticket;
  return `:drive,team_drive=${config.sharedDriveId}:${base}`;
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

function filterArgs(filter: TransferFilter): string[] {
  return [
    ...(filter.includes ?? []).flatMap((pattern) => ['--include', pattern]),
    ...(filter.excludes ?? []).flatMap((pattern) => ['--exclude', pattern]),
  ];
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

  async download(ticket: string, remoteDir: string, localDir: string, filter?: TransferFilter): Promise<void> {
    const source = join(this.remoteFor(ticket), remoteDir);
    const result = await this.rclone.run(['copy', source, localDir, '--checksum', ...filterArgs(assertFilter(filter))]);
    if (NOT_FOUND.has(result.code)) throw new StoreError('STORE_PACKET_MISSING', `${ticket}/${remoteDir} is not on the remote`);
    expectSuccess(result, 'rclone copy (download)');
  }

  async upload(ticket: string, localDir: string, remoteDir: string, filter?: TransferFilter): Promise<void> {
    const target = join(this.remoteFor(ticket), remoteDir);
    expectSuccess(
      await this.rclone.run(['copy', localDir, target, '--checksum', ...filterArgs(assertFilter(filter))]),
      'rclone copy (upload)',
    );
  }

  async listDirectories(ticket: string, remoteDir: string): Promise<string[]> {
    const result = await this.rclone.run(['lsjson', '--dirs-only', join(this.remoteFor(ticket), remoteDir)]);
    if (NOT_FOUND.has(result.code)) return [];
    const entries = JSON.parse(expectSuccess(result, 'rclone lsjson').stdout) as Listed[];
    return entries.filter((entry) => entry.IsDir).map((entry) => entry.Name).sort();
  }

  async readText(ticket: string, remoteFile: string): Promise<string | null> {
    const segments = remoteFile.split('/');
    const name = segments.pop();
    const listing = await this.rclone.run(['lsjson', '--files-only', join(this.remoteFor(ticket), segments.join('/'))]);
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
      expectSuccess(await this.rclone.run(['copyto', file, join(this.remoteFor(ticket), remoteFile)]), 'rclone copyto');
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
}
```

Commit: `feat: add the rclone transport for Google Drive`

## Task 2: run records

**Test** `test/run-record.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseRunRecord, renderRunRecord } from '../src/run-record.js';

describe('run record', () => {
  it('round-trips and keeps a numeric-looking run key as a string', () => {
    const text = renderRunRecord({
      type: 'stage-run', jira_key: 'ATT-5387', stage_folder: '20-ac-walkthrough', stage_id: 'ac-walkthrough',
      version: 'v1', run_key: '17012345678', tool: 'ac-walkthrough@6.0.0', started_at: '2026-09-04T09:12:33.120Z',
    });
    expect(text.startsWith('---\n')).toBe(true);
    expect(text).toContain('# ATT-5387 · ac-walkthrough · v1');
    expect(parseRunRecord(text).run_key).toBe('17012345678');
  });
  it('rejects a record without frontmatter or with unknown keys', () => {
    expect(() => parseRunRecord('# no frontmatter\n')).toThrow('STORE_RUN_MISSING');
    expect(() => parseRunRecord('---\ntype: stage-run\nextra: 1\n---\n')).toThrow('STORE_RUN_MISSING');
  });
});
```

**Implementation** `src/run-record.ts`:

```ts
import YAML from 'yaml';
import { z } from 'zod';
import { StoreError } from './errors.js';

export const RUN_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const RunRecordSchema = z.strictObject({
  type: z.literal('stage-run'),
  jira_key: z.string(),
  stage_folder: z.string(),
  stage_id: z.string(),
  version: z.string().regex(/^v[1-9]\d*$/),
  run_key: z.string().regex(RUN_KEY),
  tool: z.string().min(1),
  packet_sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  started_at: z.iso.datetime(),
});
export type RunRecord = z.infer<typeof RunRecordSchema>;

export function renderRunRecord(record: RunRecord): string {
  const front = YAML.stringify(RunRecordSchema.parse(record), { lineWidth: 0 });
  return `---\n${front}---\n\n# ${record.jira_key} · ${record.stage_id} · ${record.version}\n\nGenerated by task-packet-store. Do not edit.\n`;
}

export function parseRunRecord(text: string): RunRecord {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new StoreError('STORE_RUN_MISSING', 'run.md has no frontmatter');
  const parsed = RunRecordSchema.safeParse(YAML.parse(match[1]));
  if (!parsed.success) {
    throw new StoreError('STORE_RUN_MISSING', `run.md frontmatter is invalid: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  }
  return parsed.data;
}

const SnapshotSummary = z.strictObject({ reason: z.string(), inventorySha256: z.string(), checkpointAt: z.string() });

export const RunStateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  storeFile: z.string(),
  ticket: z.string(),
  stage: z.string(),
  version: z.string(),
  runKey: z.string(),
  runDirectory: z.string(),
  createdAt: z.string(),
  latestSnapshot: SnapshotSummary.nullable(),
});
export type RunState = z.infer<typeof RunStateSchema>;

export const SnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  reason: z.string(),
  checkpointAt: z.string(),
  fileCount: z.number().int(),
  inventorySha256: z.string(),
  files: z.array(z.strictObject({ path: z.string(), size: z.number().int(), sha256: z.string() })),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
```

Commit: `feat: add run.md, snapshot, and state schemas`

## Task 3: begin, checkpoint, pull

**Extend** `test/operations.shared.ts` with a second exported suite. Import `beginRun`,
`checkpointRun`, `pullRuns`, `readRunState` from `../src/operations.js`.

```ts
export function exerciseRuns(make: () => Harness): void {
  it('begin numbers runs per stage and writes run.md and a state file', async () => {
    const h = make();
    h.seed('ATT-1234', PACKET);
    const stateDir = tempDir('tps-state-');
    const first = await beginRun(h.transport, {
      ticket: 'ATT-1234', stage: '10-recon', runKey: 'run-a', tool: 'recon@1.0.0',
      stateFile: path.join(stateDir, 'a.json'), storeFile: '/abs/store.json',
    });
    expect(first.version).toBe('v1');
    const second = await beginRun(h.transport, {
      ticket: 'ATT-1234', stage: '20-ac-walkthrough', runKey: 'run-b', tool: 'ac-walkthrough@6.0.0',
      stateFile: path.join(stateDir, 'b.json'), storeFile: '/abs/store.json',
    });
    expect(second.version).toBe('v2');
    expect(h.remoteFile('ATT-1234', 'stages/20-ac-walkthrough/runs/v2/run.md')).toContain('run_key: "run-b"');
    expect(readRunState(path.join(stateDir, 'b.json')).runDirectory).toBe('stages/20-ac-walkthrough/runs/v2');
  });

  it('checkpoint uploads the source and writes snapshot.json last', async () => {
    const h = make();
    h.seed('ATT-1234', PACKET);
    const stateFile = path.join(tempDir('tps-state-'), 'state.json');
    await beginRun(h.transport, { ticket: 'ATT-1234', stage: '10-recon', runKey: 'run-a', tool: 't@1', stateFile, storeFile: '/abs/store.json' });
    const source = tempDir('tps-source-');
    writeTree(source, { 'delivery/report.html': '<html/>', 'evidence/e1.png': 'png', 'run.md': 'must not overwrite' });
    const result = await checkpointRun(h.transport, readRunState(stateFile), stateFile, 'evidence-captured', source);
    expect(result.fileCount).toBe(2);
    expect(h.remoteFile('ATT-1234', 'stages/10-recon/runs/v1/delivery/report.html')).toBe('<html/>');
    expect(h.remoteFile('ATT-1234', 'stages/10-recon/runs/v1/run.md')).toContain('run_key: "run-a"');
    expect(JSON.parse(h.remoteFile('ATT-1234', 'stages/10-recon/runs/v1/snapshot.json') ?? '{}').reason).toBe('evidence-captured');
    expect(readRunState(stateFile).latestSnapshot?.reason).toBe('evidence-captured');
  });

  it('checkpoint fails when another run owns the version', async () => {
    const h = make();
    h.seed('ATT-1234', PACKET);
    const stateFile = path.join(tempDir('tps-state-'), 'state.json');
    await beginRun(h.transport, { ticket: 'ATT-1234', stage: '10-recon', runKey: 'run-a', tool: 't@1', stateFile, storeFile: '/abs/store.json' });
    const stolen = (h.remoteFile('ATT-1234', 'stages/10-recon/runs/v1/run.md') ?? '').replace('run_key: "run-a"', 'run_key: "run-z"');
    await h.transport.writeText('ATT-1234', 'stages/10-recon/runs/v1/run.md', stolen);
    await expect(checkpointRun(h.transport, readRunState(stateFile), stateFile, 'x', tempDir('tps-source-'))).rejects.toThrow('STORE_VERSION_CONFLICT');
  });

  it('pull brings every run into a local packet and nothing else', async () => {
    const h = make();
    h.seed('ATT-1234', { ...PACKET, 'stages/10-recon/runs/v1/run.md': 'r\n', 'jira/new.md': 'not pulled\n' });
    const local = path.join(tempDir('tps-local-'), 'ATT-1234');
    writeTree(local, { 'task.md': 'local\n' });
    await pullRuns(h.transport, 'ATT-1234', local);
    expect(fs.existsSync(path.join(local, 'stages/10-recon/runs/v1/run.md'))).toBe(true);
    expect(fs.existsSync(path.join(local, 'stages/20-ac-walkthrough/runs/v1/run.md'))).toBe(true);
    expect(fs.existsSync(path.join(local, 'jira/new.md'))).toBe(false);
    expect(fs.existsSync(path.join(local, 'stages/20-ac-walkthrough/README.md'))).toBe(false);
  });
}
```

Add `exerciseRuns(makeFsHarness)` to `test/operations.fs.test.ts`. Run: expected FAIL.

**Implementation**, append to `src/operations.ts`:

```ts
import { validateStage } from './config.js';
import { sha256 } from './identity.js';
import { parseRunRecord, renderRunRecord, type RunRecord, type RunState, RunStateSchema, type Snapshot } from './run-record.js';

/** Control characters are not allowed in a checkpoint reason. Written escaped on purpose. */
const CONTROL_CHARACTER = /[\x00-\x1f\x7f]/;

export interface BeginInput {
  ticket: string;
  stage: string;
  runKey: string;
  tool: string;
  packetSha256?: string;
  stateFile: string;
  storeFile: string;
}

export async function beginRun(transport: PacketTransport, input: BeginInput) {
  validateTicket(input.ticket);
  validateStage(input.stage);
  const stateFile = assertAbsolute(input.stateFile, '--state');
  if (fs.existsSync(stateFile)) throw new StoreError('STORE_STATE_INVALID', `${stateFile} already exists`);
  const runsDir = `stages/${input.stage}/runs`;
  const numbers = (await transport.listDirectories(input.ticket, runsDir))
    .map((name) => /^v([1-9]\d*)$/.exec(name)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  const version = `v${numbers.length ? Math.max(...numbers) + 1 : 1}`;
  const record: RunRecord = {
    type: 'stage-run',
    jira_key: input.ticket,
    stage_folder: input.stage,
    stage_id: input.stage.slice(3),
    version,
    run_key: input.runKey,
    tool: input.tool,
    ...(input.packetSha256 ? { packet_sha256: input.packetSha256 } : {}),
    started_at: new Date().toISOString(),
  };
  let text: string;
  try {
    text = renderRunRecord(record);
  } catch (error) {
    throw new StoreError('STORE_CONFIG_INVALID', `invalid run inputs: ${(error as Error).message}`);
  }
  const runDirectory = `${runsDir}/${version}`;
  await transport.writeText(input.ticket, `${runDirectory}/run.md`, text);
  const state: RunState = {
    schemaVersion: 1,
    storeFile: input.storeFile,
    ticket: input.ticket,
    stage: input.stage,
    version,
    runKey: input.runKey,
    runDirectory,
    createdAt: record.started_at,
    latestSnapshot: null,
  };
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' });
  return { ticket: input.ticket, stage: input.stage, version, runKey: input.runKey, runDirectory, stateFile };
}

export function readRunState(stateFile: string): RunState {
  const file = assertAbsolute(stateFile, '--state');
  let json: unknown;
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new StoreError('STORE_STATE_INVALID', `cannot read ${file}: ${(error as Error).message}`);
  }
  const parsed = RunStateSchema.safeParse(json);
  if (!parsed.success) throw new StoreError('STORE_STATE_INVALID', `${file} is not a run state file`);
  return parsed.data;
}

export async function checkpointRun(
  transport: PacketTransport,
  state: RunState,
  stateFile: string,
  reason: string,
  source: string,
) {
  const reasonText = reason.trim();
  if (reasonText.length === 0 || reasonText.length > 100 || CONTROL_CHARACTER.test(reasonText)) {
    throw new StoreError('STORE_CONFIG_INVALID', '--reason must be 1 to 100 printable characters on one line');
  }
  const sourceDir = assertAbsolute(source, '--source');
  if (!fs.existsSync(sourceDir)) throw new StoreError('STORE_PACKET_MISSING', `${sourceDir} does not exist`);
  const remoteRun = await transport.readText(state.ticket, `${state.runDirectory}/run.md`);
  if (remoteRun === null) throw new StoreError('STORE_RUN_MISSING', `${state.runDirectory}/run.md is not on the remote`);
  const record = parseRunRecord(remoteRun);
  if (record.run_key !== state.runKey) {
    throw new StoreError('STORE_VERSION_CONFLICT', `${state.runDirectory} belongs to run ${record.run_key}, not ${state.runKey}`);
  }
  const files = regularFiles(sourceDir).filter((file) => file.path !== 'run.md' && file.path !== 'snapshot.json');
  await transport.upload(state.ticket, sourceDir, state.runDirectory, { excludes: ['/run.md', '/snapshot.json'] });
  const snapshot: Snapshot = {
    schemaVersion: 1,
    reason: reasonText,
    checkpointAt: new Date().toISOString(),
    fileCount: files.length,
    inventorySha256: sha256(JSON.stringify(files)),
    files,
  };
  await transport.writeText(state.ticket, `${state.runDirectory}/snapshot.json`, `${JSON.stringify(snapshot, null, 2)}\n`);
  const next: RunState = {
    ...state,
    latestSnapshot: { reason: snapshot.reason, inventorySha256: snapshot.inventorySha256, checkpointAt: snapshot.checkpointAt },
  };
  fs.writeFileSync(assertAbsolute(stateFile, '--state'), `${JSON.stringify(next, null, 2)}\n`);
  return { version: state.version, reason: snapshot.reason, fileCount: snapshot.fileCount, inventorySha256: snapshot.inventorySha256 };
}

export async function pullRuns(transport: PacketTransport, ticket: string, into: string) {
  validateTicket(ticket);
  const target = assertAbsolute(into, '--into');
  if (!fs.existsSync(target)) throw new StoreError('STORE_PACKET_MISSING', `${target} does not exist`);
  const stages = await transport.listDirectories(ticket, 'stages');
  if (stages.length > 0) {
    await transport.download(ticket, 'stages', path.join(target, 'stages'), { includes: ['/*/runs/**'] });
  }
  return { ticket, driver: transport.driver, into: target, stages: stages.length };
}
```

Run the fs suite: expected PASS.

Commit: `feat: begin, checkpoint, and pull stage runs`

## Task 4: the rclone suite

`test/operations.rclone.test.ts` runs both shared suites through `RcloneTransport` with a local
directory as the remote. It is skipped when rclone is absent and mandatory in CI.

```ts
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { createRcloneRunner, RcloneTransport } from '../src/rclone.js';
import { exerciseFetchAndPush, exerciseRuns, tempDir, writeTree, type Harness } from './operations.shared.js';

const hasRclone = spawnSync('rclone', ['version'], { stdio: 'ignore' }).status === 0;

function makeRcloneHarness(): Harness {
  const remoteRoot = tempDir('tps-remote-');
  const runner = createRcloneRunner({ PATH: process.env.PATH ?? '' });
  return {
    transport: new RcloneTransport(runner, (ticket) => path.join(remoteRoot, ticket)),
    config: parseStoreConfig({ driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP' }),
    seed: (ticket, tree) => writeTree(path.join(remoteRoot, ticket), tree),
    remoteFile: (ticket, relative) => {
      const file = path.join(remoteRoot, ticket, ...relative.split('/'));
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    },
  };
}

describe.skipIf(!hasRclone)('operations through RcloneTransport (local backend)', () => {
  exerciseFetchAndPush(makeRcloneHarness);
  exerciseRuns(makeRcloneHarness);
});

if (process.env.CI && !hasRclone) throw new Error('rclone is required in CI');
```

Run locally after `brew install rclone` (step 02). Expected PASS. Fix any exit-code mapping that the
local backend reveals. Record the rclone exit codes you observed for a missing directory and a
missing file in the Evidence section.

Commit: `test: run the operations suite through rclone's local backend`

## Task 5: store factory, CLI, doctor

`src/store.ts`:

```ts
import type { StoreConfig } from './config.js';
import { createRcloneRunner, driveRemote, rcloneEnv, RcloneTransport } from './rclone.js';
import { FsTransport, type PacketTransport } from './transport.js';

export function createTransport(config: StoreConfig, env: NodeJS.ProcessEnv = process.env): PacketTransport {
  if (config.driver === 'fs') return new FsTransport(config.root);
  return new RcloneTransport(createRcloneRunner(rcloneEnv(env)), (ticket) => driveRemote(config, ticket));
}
```

Add to `src/cli.ts` the commands `begin`, `checkpoint`, `pull`, `doctor`. Options follow
`docs/design/03-architecture.md`. `begin` passes `path.resolve(options.store)` as `storeFile`.
`checkpoint` reads the state, then reads the store file named in the state, then builds the
transport. `doctor` prints:

```json
{ "driver": "gdrive", "rclone": "1.75.0", "rcloneTested": "1.75.0", "credential": "PACKET_STORE_DRIVE_TOKEN",
  "remoteRoot": ":drive,team_drive=0ABc…:packets" }
```

For `fs`, `rclone` is `null` and `credential` is `"none"`. `doctor` never contacts the remote.

Update `test/cli.test.ts`: `--help` for every command lists its required options.

Commit: `feat: wire begin, checkpoint, pull, and doctor on the CLI`

## Task 6: manual round trip against the Shared Drive

Use the token from step 02 and a throwaway ticket `TPS-1`.

```bash
export PACKET_STORE_DRIVE_TOKEN='<from step 02>'
cfg=$(mktemp); printf '{"driver":"gdrive","sharedDriveId":"%s","prefix":"packets"}\n' "<sharedDriveId>" > "$cfg"
node dist/cli.js doctor --store "$cfg"
src=$(mktemp -d)/TPS-1; mkdir -p "$src/jira" "$src/stages/10-recon/runs/v9"
echo '# p' > "$src/00 Packet.md"; echo '# t' > "$src/task.md"; echo '# i' > "$src/jira/00 Issue.md"; echo stale > "$src/stages/10-recon/runs/v9/run.md"
node dist/cli.js push --store "$cfg" --ticket TPS-1 --from "$src"
node dist/cli.js fetch --store "$cfg" --ticket TPS-1 --destination "$(mktemp -d)"
state=$(mktemp -d)/state.json
node dist/cli.js begin --store "$cfg" --ticket TPS-1 --stage 10-recon --run-key manual-1 --tool manual@0 --state "$state"
out=$(mktemp -d); echo '<html/>' > "$out/report.html"
node dist/cli.js checkpoint --state "$state" --reason manual --source "$out"
local=$(mktemp -d)/TPS-1; mkdir -p "$local"
node dist/cli.js pull --store "$cfg" --ticket TPS-1 --into "$local"
find "$local" -type f
rclone lsjson -R ":drive,team_drive=<sharedDriveId>:packets/TPS-1" | jq -r '.[].Path'
```

Expected: `fetch` reports 3 files and no `runs`. `begin` reports `v1` because the stale `v9` was
never pushed. `pull` materializes `stages/10-recon/runs/v1/{run.md,snapshot.json,report.html}`.

Clean up: `rclone purge ":drive,team_drive=<sharedDriveId>:packets/TPS-1"`.

## Done when

```bash
pnpm check
```

All suites pass, including the rclone suite. The manual round trip output is in Evidence.

## Evidence

```text
rclone exit codes observed (missing dir / missing file):
manual round trip output:
```

## Rollback

Revert the commits of this step. Step 04 remains valid.
