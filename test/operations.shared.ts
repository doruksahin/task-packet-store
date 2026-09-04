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
    h.seed('PROJ-1234', PACKET);
    const result = await fetchPacket(h.transport, h.config, 'PROJ-1234', tempDir('tps-dest-'));
    expect(result.fileCount).toBe(5);
    expect(fs.existsSync(path.join(result.packetDirectory, 'stages/20-ac-walkthrough/runs'))).toBe(false);
    expect(fs.statSync(path.join(result.packetDirectory, 'task.md')).mode & 0o222).toBe(0);
    expect(result.packetSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fetch refuses an existing destination and leaves no partial directory on failure', async () => {
    const h = make();
    h.seed('PROJ-1234', PACKET);
    const destination = tempDir('tps-dest-');
    fs.mkdirSync(path.join(destination, 'PROJ-1234'));
    await expect(fetchPacket(h.transport, h.config, 'PROJ-1234', destination)).rejects.toThrow('STORE_DESTINATION_EXISTS');
    await expect(fetchPacket(h.transport, h.config, 'PROJ-9999', destination)).rejects.toThrow('STORE_PACKET_MISSING');
    expect(fs.readdirSync(destination)).toEqual(['PROJ-1234']);
  });

  it('push uploads without runs and a later fetch returns the same digest', async () => {
    const h = make();
    const local = path.join(tempDir('tps-local-'), 'PROJ-4321');
    writeTree(local, PACKET);
    await pushPacket(h.transport, h.config, 'PROJ-4321', local);
    expect(h.remoteFile('PROJ-4321', 'stages/20-ac-walkthrough/runs/v1/run.md')).toBeNull();
    expect(h.remoteFile('PROJ-4321', 'jira/00 Issue.md')).toBe('# issue\n');
    const fetched = await fetchPacket(h.transport, h.config, 'PROJ-4321', tempDir('tps-dest-'));
    expect(fetched.fileCount).toBe(5);
  });
}
