import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import type { StoreConfig } from '../src/config.js';
import { packetSha256 } from '../src/identity.js';
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

const tempDirs: string[] = [];

/** A fresh directory under the OS temp root. Every one is removed by `cleanupTempDirs`. */
export function tempDir(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
}

/** Remove every directory handed out by `tempDir`. Call it from `afterEach`. `force` copes with read-only files. */
export function cleanupTempDirs(): void {
  for (const directory of tempDirs.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
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
    h.seed('PROJ-1234', PACKET);
    const result = await fetchPacket(h.transport, h.config.identity, 'PROJ-1234', tempDir('tps-dest-'));
    expect(result.fileCount).toBe(5);
    expect(fs.existsSync(path.join(result.packetDirectory, 'stages/20-ac-walkthrough/runs'))).toBe(false);
    expect(fs.statSync(path.join(result.packetDirectory, 'task.md')).mode & 0o222).toBe(0);
    expect(fs.statSync(result.packetDirectory).mode & 0o777).toBe(0o755);
    expect(result.packetSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fetch refuses a destination that exists and is not a directory', async () => {
    const h = make();
    h.seed('PROJ-1234', PACKET);
    const destination = path.join(tempDir('tps-dest-'), 'a-file');
    fs.writeFileSync(destination, 'not a directory\n');
    await expect(fetchPacket(h.transport, h.config.identity, 'PROJ-1234', destination)).rejects.toThrow('STORE_CONFIG_INVALID');
  });

  it('fetch and push name the ticket, not a path, when no identity file exists', async () => {
    const h = make();
    h.seed('PROJ-1234', { 'stages/20-ac-walkthrough/README.md': '# stage\n' });
    const destination = tempDir('tps-dest-');
    const fetchError = await fetchPacket(h.transport, h.config.identity, 'PROJ-1234', destination).catch((error: Error) => error);
    expect(fetchError).toBeInstanceOf(Error);
    expect((fetchError as Error).message).toBe(
      `STORE_PACKET_MISSING: packet PROJ-1234 has none of the identity files ${JSON.stringify(h.config.identity)}`,
    );
    expect((fetchError as Error).message).not.toContain(destination);
    expect(fs.readdirSync(destination)).toEqual([]);
    const local = path.join(tempDir('tps-local-'), 'PROJ-4321');
    writeTree(local, { 'stages/20-ac-walkthrough/README.md': '# stage\n' });
    const pushError = await pushPacket(h.transport, h.config.identity, 'PROJ-4321', local).catch((error: Error) => error);
    expect((pushError as Error).message).toContain('STORE_PACKET_MISSING: packet PROJ-4321 has none of the identity files');
    expect((pushError as Error).message).not.toContain(local);
  });

  it('fetch never copies .DS_Store and the digest ignores it', async () => {
    const h = make();
    h.seed('PROJ-1234', { ...PACKET, 'jira/.DS_Store': 'finder noise', '.DS_Store': 'finder noise' });
    const result = await fetchPacket(h.transport, h.config.identity, 'PROJ-1234', tempDir('tps-dest-'));
    expect(result.fileCount).toBe(5);
    expect(fs.existsSync(path.join(result.packetDirectory, 'jira', '.DS_Store'))).toBe(false);
    expect(fs.existsSync(path.join(result.packetDirectory, '.DS_Store'))).toBe(false);
    const clean = path.join(tempDir('tps-local-'), 'PROJ-1234');
    writeTree(clean, PACKET);
    expect(result.packetSha256).toBe(packetSha256(clean, h.config.identity));
  });

  it('fetch refuses an existing destination and leaves no partial directory on failure', async () => {
    const h = make();
    h.seed('PROJ-1234', PACKET);
    const destination = tempDir('tps-dest-');
    fs.mkdirSync(path.join(destination, 'PROJ-1234'));
    await expect(fetchPacket(h.transport, h.config.identity, 'PROJ-1234', destination)).rejects.toThrow('STORE_DESTINATION_EXISTS');
    await expect(fetchPacket(h.transport, h.config.identity, 'PROJ-9999', destination)).rejects.toThrow('STORE_PACKET_MISSING');
    expect(fs.readdirSync(destination)).toEqual(['PROJ-1234']);
  });

  it('push uploads without runs and a later fetch returns the same digest', async () => {
    const h = make();
    const local = path.join(tempDir('tps-local-'), 'PROJ-4321');
    writeTree(local, PACKET);
    await pushPacket(h.transport, h.config.identity, 'PROJ-4321', local);
    expect(h.remoteFile('PROJ-4321', 'stages/20-ac-walkthrough/runs/v1/run.md')).toBeNull();
    expect(h.remoteFile('PROJ-4321', 'jira/00 Issue.md')).toBe('# issue\n');
    const fetched = await fetchPacket(h.transport, h.config.identity, 'PROJ-4321', tempDir('tps-dest-'));
    expect(fetched.fileCount).toBe(5);
  });
}
