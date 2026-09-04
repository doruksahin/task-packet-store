import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { IGNORED_BASENAMES } from './config.js';
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

/** Every regular file under root, as POSIX-relative paths sorted by path bytes. Skips IGNORED_BASENAMES. Non-regular entries fail. */
export function listFiles(root: string, directory: string = root): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (IGNORED_BASENAMES.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(root, absolute));
      continue;
    }
    if (!entry.isFile()) throw new StoreError('STORE_PACKET_UNSAFE', `non-regular entry: ${absolute}`);
    files.push(path.relative(root, absolute).split(path.sep).join('/'));
  }
  return files.sort(byteCompare);
}

function describe(root: string, relative: string): PacketFile {
  const bytes = fs.readFileSync(path.join(root, ...relative.split('/')));
  return { path: relative, size: bytes.length, sha256: sha256(bytes) };
}

/** `listFiles` plus size and SHA-256 of every file's bytes. */
export function regularFiles(root: string): PacketFile[] {
  return listFiles(root).map((relative) => describe(root, relative));
}

/** An identity entry is an exact file or `dir/**`. */
export function matchesIdentity(relativePath: string, identity: readonly string[]): boolean {
  return identity.some((entry) => (entry.endsWith('/**') ? relativePath.startsWith(entry.slice(0, -2)) : relativePath === entry));
}

/** Packet identity: SHA-256 of the sorted per-file manifest of identity files. */
export function packetSha256(root: string, identity: readonly string[]): string {
  const files = listFiles(root)
    .filter((relative) => matchesIdentity(relative, identity))
    .map((relative) => describe(root, relative));
  if (files.length === 0) throw new StoreError('STORE_PACKET_MISSING', `no identity files under ${root}`);
  return sha256(JSON.stringify(files));
}
