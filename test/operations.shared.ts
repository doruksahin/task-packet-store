import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import type { StoreConfig } from '../src/config.js';
import { packetSha256 } from '../src/identity.js';
import {
  beginRun,
  checkpointRun,
  fetchPacket,
  pullRuns,
  pushPacket,
  readRunState,
} from '../src/operations.js';
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
    writeTree(local, { ...PACKET, '.DS_Store': 'finder noise', 'jira/.DS_Store': 'finder noise' });
    await pushPacket(h.transport, h.config.identity, 'PROJ-4321', local);
    expect(h.remoteFile('PROJ-4321', 'stages/20-ac-walkthrough/runs/v1/run.md')).toBeNull();
    expect(h.remoteFile('PROJ-4321', '.DS_Store')).toBeNull();
    expect(h.remoteFile('PROJ-4321', 'jira/.DS_Store')).toBeNull();
    expect(h.remoteFile('PROJ-4321', 'jira/00 Issue.md')).toBe('# issue\n');
    const fetched = await fetchPacket(h.transport, h.config.identity, 'PROJ-4321', tempDir('tps-dest-'));
    expect(fetched.fileCount).toBe(5);
    expect(fetched.packetSha256).toBe(packetSha256(local, h.config.identity));
  });
}

export function exerciseRuns(make: () => Harness): void {
  it('begin rejects an explicitly empty packet digest before reserving a run', async () => {
    const h = make();
    h.seed('PROJ-1234', PACKET);
    await expect(
      beginRun(h.transport, {
        ticket: 'PROJ-1234',
        stage: '10-recon',
        runKey: 'run-a',
        tool: 'recon@1.0.0',
        packetSha256: '',
        stateFile: path.join(tempDir('tps-state-'), 'state.json'),
        storeFile: '/abs/store.json',
      }),
    ).rejects.toThrow('STORE_CONFIG_INVALID');
    expect(h.remoteFile('PROJ-1234', 'stages/10-recon/runs/v1/run.md')).toBeNull();
  });

  it('begin rejects a relative store path before reserving a run', async () => {
    const h = make();
    h.seed('PROJ-1234', PACKET);
    await expect(
      beginRun(h.transport, {
        ticket: 'PROJ-1234',
        stage: '10-recon',
        runKey: 'run-a',
        tool: 'recon@1.0.0',
        stateFile: path.join(tempDir('tps-state-'), 'state.json'),
        storeFile: 'relative/store.json',
      }),
    ).rejects.toThrow('STORE_CONFIG_INVALID');
    expect(h.remoteFile('PROJ-1234', 'stages/10-recon/runs/v1/run.md')).toBeNull();
  });

  it('begin numbers runs per stage and writes run.md and a state file', async () => {
    const h = make();
    h.seed('PROJ-1234', PACKET);
    const stateDir = tempDir('tps-state-');
    const first = await beginRun(h.transport, {
      ticket: 'PROJ-1234',
      stage: '10-recon',
      runKey: 'run-a',
      tool: 'recon@1.0.0',
      stateFile: path.join(stateDir, 'a.json'),
      storeFile: '/abs/store.json',
    });
    expect(first.version).toBe('v1');
    const second = await beginRun(h.transport, {
      ticket: 'PROJ-1234',
      stage: '20-ac-walkthrough',
      runKey: 'run-b',
      tool: 'ac-walkthrough@6.0.0',
      stateFile: path.join(stateDir, 'b.json'),
      storeFile: '/abs/store.json',
    });
    expect(second.version).toBe('v2');
    expect(h.remoteFile('PROJ-1234', 'stages/20-ac-walkthrough/runs/v2/run.md')).toContain('run_key: run-b');
    expect(readRunState(path.join(stateDir, 'b.json')).runDirectory).toBe('stages/20-ac-walkthrough/runs/v2');
  });

  it('checkpoint uploads the source and writes snapshot.json', async () => {
    const h = make();
    h.seed('PROJ-1234', PACKET);
    const stateFile = path.join(tempDir('tps-state-'), 'state.json');
    await beginRun(h.transport, {
      ticket: 'PROJ-1234',
      stage: '10-recon',
      runKey: 'run-a',
      tool: 't@1',
      stateFile,
      storeFile: '/abs/store.json',
    });
    const source = tempDir('tps-source-');
    writeTree(source, {
      'delivery/report.html': '<html/>',
      'evidence/e1.png': 'png',
      'run.md': 'must not overwrite',
    });
    const result = await checkpointRun(
      h.transport,
      readRunState(stateFile),
      stateFile,
      'evidence-captured',
      source,
    );
    expect(result.fileCount).toBe(2);
    expect(h.remoteFile('PROJ-1234', 'stages/10-recon/runs/v1/delivery/report.html')).toBe('<html/>');
    expect(h.remoteFile('PROJ-1234', 'stages/10-recon/runs/v1/run.md')).toContain('run_key: run-a');
    expect(JSON.parse(h.remoteFile('PROJ-1234', 'stages/10-recon/runs/v1/snapshot.json') ?? '{}').reason).toBe(
      'evidence-captured',
    );
    expect(readRunState(stateFile).latestSnapshot?.reason).toBe('evidence-captured');
  });

  it('checkpoint fails when another run owns the version', async () => {
    const h = make();
    h.seed('PROJ-1234', PACKET);
    const stateFile = path.join(tempDir('tps-state-'), 'state.json');
    await beginRun(h.transport, {
      ticket: 'PROJ-1234',
      stage: '10-recon',
      runKey: 'run-a',
      tool: 't@1',
      stateFile,
      storeFile: '/abs/store.json',
    });
    const stolen = (h.remoteFile('PROJ-1234', 'stages/10-recon/runs/v1/run.md') ?? '').replace(
      'run_key: run-a',
      'run_key: run-z',
    );
    await h.transport.writeText('PROJ-1234', 'stages/10-recon/runs/v1/run.md', stolen);
    await expect(
      checkpointRun(h.transport, readRunState(stateFile), stateFile, 'x', tempDir('tps-source-')),
    ).rejects.toThrow('STORE_VERSION_CONFLICT');
  });

  it('pull brings every run into a local packet and nothing else', async () => {
    const h = make();
    h.seed('PROJ-1234', {
      ...PACKET,
      'stages/10-recon/runs/v1/run.md': 'r\n',
      'jira/new.md': 'not pulled\n',
    });
    const local = path.join(tempDir('tps-local-'), 'PROJ-1234');
    writeTree(local, { 'task.md': 'local\n' });
    await pullRuns(h.transport, 'PROJ-1234', local);
    expect(fs.existsSync(path.join(local, 'stages/10-recon/runs/v1/run.md'))).toBe(true);
    expect(fs.existsSync(path.join(local, 'stages/20-ac-walkthrough/runs/v1/run.md'))).toBe(true);
    expect(fs.existsSync(path.join(local, 'jira/new.md'))).toBe(false);
    expect(fs.existsSync(path.join(local, 'stages/20-ac-walkthrough/README.md'))).toBe(false);
  });
}
