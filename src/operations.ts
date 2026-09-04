import fs from 'node:fs';
import path from 'node:path';
import { RUNS_GLOB, type StoreConfig, validateTicket } from './config.js';
import { StoreError } from './errors.js';
import { listFiles, packetSha256 } from './identity.js';
import type { PacketTransport } from './transport.js';

const SAFE_SEGMENT = /^(?!\.{1,2}$)[^/\\\0]+$/;

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
