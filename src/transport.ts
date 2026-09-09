import fs from 'node:fs';
import path from 'node:path';
import { SAFE_SEGMENT, validateLocationPath, validateTicket } from './config.js';
import { StoreError } from './errors.js';
import { copyFile, replaceFile } from './fs-file.js';
import { matchesAny } from './glob.js';
import { listFiles } from './identity.js';

/**
 * Anchored globs to keep (`includes`) or to drop (`excludes`), never both: rclone treats the mix
 * differently across versions. The `never` members make a literal with both keys a type error.
 */
export type TransferFilter =
  | { readonly includes: readonly string[]; readonly excludes?: never }
  | { readonly excludes: readonly string[]; readonly includes?: never };

export type Driver = 'fs' | 'gdrive' | 'git';

export interface ResultLocation {
  kind: 'directory' | 'file';
  location: string;
}

export interface PacketTransport {
  readonly driver: Driver;
  /** Existing file/directory location, using existing access permissions only. Null means absent. */
  locate(ticket: string, relativePath: string): Promise<ResultLocation | null>;
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

/** Runtime guard for JavaScript callers and deserialized values that bypass the TypeScript union. */
export function assertFilter(filter?: TransferFilter): TransferFilter | undefined {
  if (filter && filter.includes !== undefined && filter.excludes !== undefined) {
    throw new StoreError('STORE_CONFIG_INVALID', 'a transfer filter cannot contain both includes and excludes');
  }
  return filter;
}

/** No filter keeps everything. `includes` keeps only matches. `excludes` drops matches. */
export function selected(relativePath: string, filter?: TransferFilter): boolean {
  const checked = assertFilter(filter);
  if (checked?.includes !== undefined) return matchesAny(checked.includes, relativePath);
  return !matchesAny(checked?.excludes, relativePath);
}

function copyTree(from: string, to: string, filter?: TransferFilter): void {
  assertFilter(filter);
  for (const relative of listFiles(from)) {
    if (!selected(relative, filter)) continue;
    const target = path.join(to, ...relative.split('/'));
    copyFile(path.join(from, ...relative.split('/')), target);
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

  async locate(ticket: string, relativePath: string): Promise<ResultLocation | null> {
    validateTicket(ticket);
    validateLocationPath(relativePath);
    const segments = [ticket, ...(relativePath ? relativePath.split('/') : [])];
    let target = path.resolve(this.root);
    for (const [index, segment] of segments.entries()) {
      target = path.join(target, segment);
      const stat = fs.lstatSync(target, { throwIfNoEntry: false });
      if (!stat) return null;
      if (!stat.isDirectory() && !stat.isFile()) {
        throw new StoreError('STORE_PACKET_UNSAFE', 'result path contains a symlink or non-regular file');
      }
      if (index === segments.length - 1) {
        return { kind: stat.isDirectory() ? 'directory' : 'file', location: target };
      }
      if (!stat.isDirectory()) return null;
    }
    return null;
  }

  /** <root>/<ticket>/<relative>. Every segment must be SAFE_SEGMENT, so no caller can escape the ticket. */
  private at(ticket: string, relative: string): string {
    const segments = [ticket, ...relative.split('/').filter(Boolean)];
    for (const segment of segments) {
      if (!SAFE_SEGMENT.test(segment)) throw new StoreError('STORE_CONFIG_INVALID', `unsafe path segment: ${segment}`);
    }
    return path.join(this.root, ...segments);
  }

  async download(ticket: string, remoteDir: string, localDir: string, filter?: TransferFilter): Promise<void> {
    const source = this.at(ticket, remoteDir);
    const stat = fs.statSync(source, { throwIfNoEntry: false });
    if (!stat) throw new StoreError('STORE_PACKET_MISSING', `${source} does not exist`);
    if (!stat.isDirectory()) throw new StoreError('STORE_PACKET_MISSING', `${source} is not a directory`);
    copyTree(source, localDir, filter);
  }

  async upload(ticket: string, localDir: string, remoteDir: string, filter?: TransferFilter): Promise<void> {
    const target = this.at(ticket, remoteDir);
    if (!fs.existsSync(localDir)) return;
    assertDisjoint(localDir, target);
    copyTree(localDir, target, filter);
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
    const existing = fs.statSync(file, { throwIfNoEntry: false });
    replaceFile(file, temporary => {
      fs.writeFileSync(temporary, text, 'utf8');
      if (existing) fs.chmodSync(temporary, existing.mode & 0o7777);
    });
  }
}
