import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { beginRun, checkpointRun, fetchPacket, pullRuns, pushPacket, readRunState } from '../src/operations.js';
import { listFiles, regularFiles, sha256 } from '../src/identity.js';
import { FsTransport } from '../src/transport.js';
import {
  PACKET,
  cleanupTempDirs,
  exerciseFetchAndPush,
  exerciseRuns,
  tempDir,
  writeTree,
  type Harness,
} from './operations.shared.js';

afterEach(() => {
  vi.restoreAllMocks();
  cleanupTempDirs();
});

function makeFsHarness(): Harness & { root: string } {
  const root = tempDir('tps-store-');
  return {
    root,
    transport: new FsTransport(root),
    config: parseStoreConfig({ driver: 'fs', root }),
    seed: (ticket, tree) => writeTree(path.join(root, ticket), tree),
    remoteFile: (ticket, relative) => {
      const file = path.join(root, ticket, ...relative.split('/'));
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    },
  };
}

describe('operations through FsTransport', () => {
  exerciseFetchAndPush(makeFsHarness);
  exerciseRuns(makeFsHarness);

  it('checkpoints unchanged and changed sealed evidence into the same reserved run', async () => {
    const h = makeFsHarness();
    h.seed('PROJ-123', { 'stages/20-ac-walkthrough/runs/v1/run.md': 'earlier run' });
    const stateFile = path.join(tempDir('tps-state-'), 'state.json');
    const run = await beginRun(h.transport, {
      ticket: 'PROJ-123', stage: '20-ac-walkthrough', runKey: 'sealed', tool: 't@1',
      stateFile, storeFile: '/abs/store.json',
    });
    expect(run.version).toBe('v2');
    const source = tempDir('tps-source-');
    const relative = 'input/capture/capture-selection.json';
    writeTree(source, { [relative]: 'first', 'delivery/report.html': '<html/>', 'run.md': 'excluded' });
    const sourceFile = path.join(source, relative);
    const remote = path.join(h.root, 'PROJ-123', run.runDirectory);
    const record = fs.readFileSync(path.join(remote, 'run.md'));
    const digests: string[] = [];
    for (const reason of ['initialized', 'unchanged', 'changed']) {
      fs.chmodSync(sourceFile, 0o644);
      fs.writeFileSync(sourceFile, reason === 'changed' ? 'updated' : 'first');
      fs.chmodSync(sourceFile, 0o444);
      const before = regularFiles(source);
      const files = before.filter(file => file.path !== 'run.md');
      const result = await checkpointRun(h.transport, readRunState(stateFile), stateFile, reason, source);
      digests.push(result.inventorySha256);
      expect(result).toEqual({ version: 'v2', reason, fileCount: 2, inventorySha256: sha256(JSON.stringify(files)) });
      expect(JSON.parse(fs.readFileSync(path.join(remote, 'snapshot.json'), 'utf8'))).toMatchObject({
        reason, files, fileCount: 2, inventorySha256: result.inventorySha256,
      });
      expect(readRunState(stateFile).latestSnapshot).toMatchObject({ reason, inventorySha256: result.inventorySha256 });
      expect(regularFiles(source)).toEqual(before);
      expect(fs.statSync(sourceFile).mode & 0o777).toBe(0o444);
      expect(fs.readFileSync(path.join(remote, relative))).toEqual(fs.readFileSync(sourceFile));
      expect(fs.statSync(path.join(remote, relative)).mode & 0o777).toBe(0o444);
      expect(listFiles(remote)).toEqual(['delivery/report.html', relative, 'run.md', 'snapshot.json']);
      expect(fs.readdirSync(path.join(remote, 'input/capture'))).toEqual(['capture-selection.json']);
      expect(fs.readFileSync(path.join(remote, 'run.md'))).toEqual(record);
      expect(h.remoteFile('PROJ-123', 'stages/20-ac-walkthrough/runs/v1/run.md')).toBe('earlier run');
      fs.chmodSync(path.join(remote, 'snapshot.json'), 0o444);
    }
    expect(digests[1]).toBe(digests[0]);
    expect(digests[2]).not.toBe(digests[1]);
  });

  it('pull merges repeated sealed run updates without deleting existing local files', async () => {
    const h = makeFsHarness();
    const relative = 'stages/20-ac-walkthrough/runs/v1/input/capture.json';
    h.seed('PROJ-123', { [relative]: 'first' });
    const source = path.join(h.root, 'PROJ-123', relative);
    const local = tempDir('tps-local-');
    writeTree(local, { 'task.md': 'local packet', 'stages/20-ac-walkthrough/runs/v1/local.txt': 'keep' });
    for (const bytes of ['first', 'first', 'changed']) {
      fs.chmodSync(source, 0o644);
      fs.writeFileSync(source, bytes);
      fs.chmodSync(source, 0o444);
      await pullRuns(h.transport, 'PROJ-123', local);
      expect(fs.readFileSync(path.join(local, relative), 'utf8')).toBe(bytes);
      expect(fs.statSync(path.join(local, relative)).mode & 0o777).toBe(0o444);
      expect(fs.readFileSync(source, 'utf8')).toBe(bytes);
      expect(fs.statSync(source).mode & 0o777).toBe(0o444);
      expect(listFiles(local)).toEqual([
        relative, 'stages/20-ac-walkthrough/runs/v1/local.txt', 'task.md',
      ]);
      expect(fs.readdirSync(path.dirname(path.join(local, relative)))).toEqual(['capture.json']);
      expect(fs.readFileSync(path.join(local, 'task.md'), 'utf8')).toBe('local packet');
      expect(fs.readFileSync(path.join(local, 'stages/20-ac-walkthrough/runs/v1/local.txt'), 'utf8')).toBe('keep');
    }
  });

  it('a failed checkpoint copy preserves the old target, snapshot and state without staging debris', async () => {
    const h = makeFsHarness();
    const stateFile = path.join(tempDir('tps-state-'), 'state.json');
    const run = await beginRun(h.transport, {
      ticket: 'PROJ-123', stage: '20-ac-walkthrough', runKey: 'sealed', tool: 't@1',
      stateFile, storeFile: '/abs/store.json',
    });
    const source = tempDir('tps-source-');
    writeTree(source, { 'capture.json': 'old' });
    fs.chmodSync(path.join(source, 'capture.json'), 0o444);
    await checkpointRun(h.transport, readRunState(stateFile), stateFile, 'initialized', source);
    const remote = path.join(h.root, 'PROJ-123', run.runDirectory);
    const before = regularFiles(remote);
    const stateBefore = fs.readFileSync(stateFile);
    const failure = new Error('injected checkpoint copy failure');
    vi.spyOn(fs, 'copyFileSync').mockImplementation((_from, to) => {
      if (fs.existsSync(to)) fs.chmodSync(to, 0o644);
      fs.writeFileSync(to, 'partial', { mode: 0o444 });
      throw failure;
    });
    await expect(checkpointRun(h.transport, readRunState(stateFile), stateFile, 'failed', source)).rejects.toBe(failure);
    expect(regularFiles(remote)).toEqual(before);
    expect(fs.readFileSync(stateFile)).toEqual(stateBefore);
    expect(fs.statSync(path.join(remote, 'capture.json')).mode & 0o777).toBe(0o444);
    expect(fs.readdirSync(remote).sort()).toEqual(['capture.json', 'run.md', 'snapshot.json']);
  });

  it('pull preserves the old local file and leaves no partial staging when its final copy fails', async () => {
    const h = makeFsHarness();
    const relative = 'stages/20-ac-walkthrough/runs/v1/capture.json';
    h.seed('PROJ-123', { [relative]: 'new bytes' });
    const local = tempDir('tps-local-');
    writeTree(local, { [relative]: 'old bytes' });
    const target = path.join(local, relative);
    fs.chmodSync(target, 0o444);
    const copy = fs.copyFileSync;
    const failure = new Error('injected final pull copy failure');
    vi.spyOn(fs, 'copyFileSync').mockImplementation((from, to, flags) => {
      if (String(to).startsWith(local + path.sep)) {
        if (fs.existsSync(to)) fs.chmodSync(to, 0o644);
        fs.writeFileSync(to, 'partial', { mode: 0o444 });
        throw failure;
      }
      copy(from, to, flags);
    });
    await expect(pullRuns(h.transport, 'PROJ-123', local)).rejects.toBe(failure);
    expect(fs.readFileSync(target, 'utf8')).toBe('old bytes');
    expect(fs.statSync(target).mode & 0o777).toBe(0o444);
    expect(fs.readdirSync(path.dirname(target))).toEqual(['capture.json']);
    expect(h.remoteFile('PROJ-123', relative)).toBe('new bytes');
  });
});

describe('push through FsTransport and the store location', () => {
  it('rejects a push from <root>/<ticket> itself', async () => {
    const h = makeFsHarness();
    h.seed('PROJ-1', PACKET);
    await expect(pushPacket(h.transport, h.config.identity, 'PROJ-1', path.join(h.root, 'PROJ-1'))).rejects.toThrow(
      'STORE_CONFIG_INVALID',
    );
  });

  it('rejects a push from a symlink alias of the store root', async () => {
    const h = makeFsHarness();
    h.seed('PROJ-1', PACKET);
    const alias = path.join(tempDir('tps-alias-'), 'store');
    fs.symlinkSync(h.root, alias);
    await expect(pushPacket(h.transport, h.config.identity, 'PROJ-1', path.join(alias, 'PROJ-1'))).rejects.toThrow(
      'STORE_CONFIG_INVALID',
    );
  });

  it('accepts a push from an unrelated directory', async () => {
    const h = makeFsHarness();
    const local = path.join(tempDir('tps-local-'), 'PROJ-1');
    writeTree(local, PACKET);
    await expect(pushPacket(h.transport, h.config.identity, 'PROJ-1', local)).resolves.toEqual({
      ticket: 'PROJ-1',
      driver: 'fs',
      from: local,
    });
    expect(h.remoteFile('PROJ-1', 'task.md')).toBe('# task\n');
  });
});

describe('fetch through FsTransport and unsafe packets', () => {
  it('rejects a packet holding a symlink and leaves no partial directory', async () => {
    const h = makeFsHarness();
    h.seed('PROJ-1', PACKET);
    fs.symlinkSync(path.join(h.root, 'PROJ-1', 'task.md'), path.join(h.root, 'PROJ-1', 'jira', 'link.md'));
    const destination = tempDir('tps-dest-');
    await expect(fetchPacket(h.transport, h.config.identity, 'PROJ-1', destination)).rejects.toThrow('STORE_PACKET_UNSAFE');
    expect(fs.readdirSync(destination)).toEqual([]);
  });
});

describe('run state validation', () => {
  it.each([
    ['storeFile', 'relative/store.json'],
    ['ticket', 'proj-1'],
    ['stage', 'recon'],
    ['version', 'v0'],
    ['runKey', 'not a valid key'],
    ['runDirectory', '../outside'],
    ['createdAt', 'yesterday'],
  ])('rejects an invalid %s from a hand-edited state file', (field, value) => {
    const stateFile = path.join(tempDir('tps-state-'), 'state.json');
    const state = {
      schemaVersion: 1,
      storeFile: '/abs/store.json',
      ticket: 'PROJ-1',
      stage: '10-recon',
      version: 'v1',
      runKey: 'run-1',
      runDirectory: 'stages/10-recon/runs/v1',
      createdAt: '2026-09-04T09:12:33.120Z',
      latestSnapshot: null,
      [field]: value,
    };
    fs.writeFileSync(stateFile, JSON.stringify(state));
    expect(() => readRunState(stateFile)).toThrow('STORE_STATE_INVALID');
  });
});
