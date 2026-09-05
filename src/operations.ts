import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RUNS_GLOB, SAFE_SEGMENT, validateLocationPath, validateStage, validateTicket } from './config.js';
import { StoreError } from './errors.js';
import { copyFile } from './fs-file.js';
import { listFiles, packetSha256, regularFiles, sha256 } from './identity.js';
import {
  parseRunRecord,
  renderRunRecord,
  type RunRecord,
  type RunState,
  RunStateSchema,
  type Snapshot,
} from './run-record.js';
import type { Driver, PacketTransport, ResultLocation } from './transport.js';

export interface LocationResult extends ResultLocation {
  ticket: string;
  driver: Driver;
  relativePath: string;
}

export async function locateResult(
  transport: PacketTransport,
  ticket: string,
  relativePath = '',
): Promise<LocationResult> {
  validateTicket(ticket);
  validateLocationPath(relativePath);
  const result = await transport.locate(ticket, relativePath);
  if (!result) throw new StoreError('STORE_LOCATION_MISSING', `${ticket}/${relativePath} does not exist`);
  return { ticket, driver: transport.driver, relativePath, ...result };
}

/** Control characters are not allowed in a checkpoint reason. */
const CONTROL_CHARACTER = /[\x00-\x1f\x7f]/;

export function assertAbsolute(value: string, label: string): string {
  if (!path.isAbsolute(value)) throw new StoreError('STORE_CONFIG_INVALID', `${label} must be an absolute path`);
  return path.resolve(value);
}

/** Every downloaded path is checked before the packet is accepted: relative, no `.`/`..`, no backslashes. */
function assertSafeTree(root: string): string[] {
  const files = listFiles(root);
  for (const file of files) {
    for (const segment of file.split('/')) {
      if (!SAFE_SEGMENT.test(segment)) throw new StoreError('STORE_PACKET_UNSAFE', `unsafe path: ${file}`);
    }
  }
  return files;
}

function freeze(root: string): void {
  for (const file of listFiles(root)) fs.chmodSync(path.join(root, ...file.split('/')), 0o444);
}

/** `packetSha256`, with its missing-identity failure rephrased around the ticket instead of a local path. */
function digestOf(root: string, ticket: string, identity: readonly string[]): string {
  try {
    return packetSha256(root, identity);
  } catch (error) {
    if (error instanceof StoreError && error.code === 'STORE_PACKET_MISSING') {
      throw new StoreError(
        'STORE_PACKET_MISSING',
        `packet ${ticket} has none of the identity files ${JSON.stringify(identity)}`,
      );
    }
    throw error;
  }
}

export interface FetchResult {
  ticket: string;
  packetDirectory: string;
  fileCount: number;
  packetSha256: string;
  driver: Driver;
}

export async function fetchPacket(
  transport: PacketTransport,
  identity: readonly string[],
  ticket: string,
  destination: string,
): Promise<FetchResult> {
  validateTicket(ticket);
  const parent = assertAbsolute(destination, '--destination');
  const parentStat = fs.statSync(parent, { throwIfNoEntry: false });
  if (parentStat && !parentStat.isDirectory()) {
    throw new StoreError('STORE_CONFIG_INVALID', `--destination ${parent} exists and is not a directory`);
  }
  const final = path.join(parent, ticket);
  if (fs.existsSync(final)) throw new StoreError('STORE_DESTINATION_EXISTS', `${final} already exists`);
  fs.mkdirSync(parent, { recursive: true });
  const temp = fs.mkdtempSync(path.join(parent, `.${ticket}.partial-`));
  try {
    await transport.download(ticket, '', temp, { excludes: [RUNS_GLOB] });
    const fileCount = assertSafeTree(temp).length;
    if (fileCount === 0) throw new StoreError('STORE_PACKET_MISSING', `no files for ${ticket}`);
    const digest = digestOf(temp, ticket, identity);
    freeze(temp);
    fs.chmodSync(temp, 0o755); // mkdtemp made it 0700; the packet root should read like its subdirectories
    fs.renameSync(temp, final);
    return { ticket, packetDirectory: final, fileCount, packetSha256: digest, driver: transport.driver };
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

export interface PushResult {
  ticket: string;
  driver: Driver;
  from: string;
}

export async function pushPacket(
  transport: PacketTransport,
  identity: readonly string[],
  ticket: string,
  from: string,
): Promise<PushResult> {
  validateTicket(ticket);
  const source = assertAbsolute(from, '--from');
  if (!fs.existsSync(source)) throw new StoreError('STORE_PACKET_MISSING', `${source} does not exist`);
  digestOf(source, ticket, identity);
  await transport.upload(ticket, source, '', { excludes: [RUNS_GLOB] });
  return { ticket, driver: transport.driver, from: source };
}

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
  const storeFile = assertAbsolute(input.storeFile, '--store');
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
    ...(input.packetSha256 !== undefined ? { packet_sha256: input.packetSha256 } : {}),
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
    storeFile,
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
  return {
    ticket: input.ticket,
    stage: input.stage,
    version,
    runKey: input.runKey,
    runDirectory,
    stateFile,
  };
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
  if (remoteRun === null) {
    throw new StoreError('STORE_RUN_MISSING', `${state.runDirectory}/run.md is not on the remote`);
  }
  const record = parseRunRecord(remoteRun);
  if (record.run_key !== state.runKey) {
    throw new StoreError(
      'STORE_VERSION_CONFLICT',
      `${state.runDirectory} belongs to run ${record.run_key}, not ${state.runKey}`,
    );
  }

  const files = regularFiles(sourceDir).filter((file) => file.path !== 'run.md' && file.path !== 'snapshot.json');
  await transport.upload(state.ticket, sourceDir, state.runDirectory, {
    excludes: ['/run.md', '/snapshot.json'],
  });
  const snapshot: Snapshot = {
    schemaVersion: 1,
    reason: reasonText,
    checkpointAt: new Date().toISOString(),
    fileCount: files.length,
    inventorySha256: sha256(JSON.stringify(files)),
    files,
  };
  await transport.writeText(
    state.ticket,
    `${state.runDirectory}/snapshot.json`,
    `${JSON.stringify(snapshot, null, 2)}\n`,
  );

  const next: RunState = {
    ...state,
    latestSnapshot: {
      reason: snapshot.reason,
      inventorySha256: snapshot.inventorySha256,
      checkpointAt: snapshot.checkpointAt,
    },
  };
  fs.writeFileSync(assertAbsolute(stateFile, '--state'), `${JSON.stringify(next, null, 2)}\n`);
  return {
    version: state.version,
    reason: snapshot.reason,
    fileCount: snapshot.fileCount,
    inventorySha256: snapshot.inventorySha256,
  };
}

export async function pullRuns(transport: PacketTransport, ticket: string, into: string) {
  validateTicket(ticket);
  const target = assertAbsolute(into, '--into');
  if (!fs.existsSync(target)) throw new StoreError('STORE_PACKET_MISSING', `${target} does not exist`);
  const stages = await transport.listDirectories(ticket, 'stages');
  if (stages.length > 0) {
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'tps-pull-'));
    try {
      await transport.download(ticket, 'stages', staging, { includes: ['/*/runs/**'] });
      const files = assertSafeTree(staging);
      for (const relative of files) {
        const destination = path.join(target, 'stages', ...relative.split('/'));
        copyFile(path.join(staging, ...relative.split('/')), destination);
      }
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
    }
  }
  return { ticket, driver: transport.driver, into: target, stages: stages.length };
}
