import fs from 'node:fs';
import path from 'node:path';
import { StoreError } from './errors.js';
import { matchesAny } from './glob.js';
import { listFiles } from './identity.js';

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

function copyTree(from: string, to: string, filter: TransferFilter): void {
  for (const relative of listFiles(from)) {
    if (!selected(relative, filter)) continue;
    const target = path.join(to, ...relative.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(from, ...relative.split('/')), target);
  }
}

/** realpath of `target`; when it does not exist yet, realpath of its deepest existing ancestor plus the missing tail. */
function intendedRealpath(target: string): string {
  const missing: string[] = [];
  let current = path.resolve(target);
  while (!fs.existsSync(current)) {
    missing.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.join(fs.realpathSync(current), ...missing);
}

function contains(outer: string, inner: string): boolean {
  return inner === outer || inner.startsWith(outer + path.sep);
}

/** A copy from a directory onto itself, or across an ancestor, would read what it writes. Refuse both. */
function assertDisjoint(localDir: string, target: string): void {
  const source = fs.realpathSync(localDir);
  const store = intendedRealpath(target);
  if (contains(source, store) || contains(store, source)) {
    throw new StoreError('STORE_CONFIG_INVALID', 'source is inside or equal to the store location for this ticket');
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
    const target = this.at(ticket, remoteDir);
    if (!fs.existsSync(localDir)) return;
    assertDisjoint(localDir, target);
    copyTree(localDir, target, assertFilter(filter));
  }

  async listDirectories(ticket: string, remoteDir: string): Promise<string[]> {
    const directory = this.at(ticket, remoteDir);
    if (!fs.existsSync(directory)) return [];
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
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
