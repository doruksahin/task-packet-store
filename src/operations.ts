import fs from 'node:fs';
import path from 'node:path';
import { RUNS_GLOB, SAFE_SEGMENT, validateTicket } from './config.js';
import { StoreError } from './errors.js';
import { listFiles, packetSha256 } from './identity.js';
import type { Driver, PacketTransport } from './transport.js';

export function assertAbsolute(value: string, label: string): string {
  if (!path.isAbsolute(value)) throw new StoreError('STORE_CONFIG_INVALID', `${label} must be an absolute path`);
  return path.resolve(value);
}

/** Every downloaded path is checked before the packet is accepted: relative, no `.`/`..`, no backslashes. */
function assertSafeTree(root: string): number {
  const files = listFiles(root);
  for (const file of files) {
    for (const segment of file.split('/')) {
      if (!SAFE_SEGMENT.test(segment)) throw new StoreError('STORE_PACKET_UNSAFE', `unsafe path: ${file}`);
    }
  }
  return files.length;
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
    const fileCount = assertSafeTree(temp);
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
