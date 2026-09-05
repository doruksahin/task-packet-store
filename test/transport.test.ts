import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertFilter, FsTransport, selected, type TransferFilter } from '../src/transport.js';
import { cleanupTempDirs, tempDir, writeTree } from './operations.shared.js';

afterEach(() => {
  vi.restoreAllMocks();
  cleanupTempDirs();
});

describe('FsTransport file replacement', () => {
  it.each(['upload', 'download'] as const)('%s replaces sealed files without changing the source', async (direction) => {
    const root = tempDir('tps-store-');
    const local = tempDir('tps-local-');
    const remote = path.join(root, 'PROJ-1');
    const source = direction === 'upload' ? local : remote;
    const destination = direction === 'upload' ? remote : local;
    writeTree(source, { 'evidence/capture.json': 'first' });
    const sourceFile = path.join(source, 'evidence/capture.json');
    const target = path.join(destination, 'evidence/capture.json');
    const transport = new FsTransport(root);
    for (const bytes of ['first', 'first', 'changed']) {
      fs.chmodSync(sourceFile, 0o644);
      fs.writeFileSync(sourceFile, bytes);
      fs.chmodSync(sourceFile, 0o444);
      if (direction === 'upload') await transport.upload('PROJ-1', local, '');
      else await transport.download('PROJ-1', '', local);
      expect(fs.readFileSync(target, 'utf8')).toBe(bytes);
      expect(fs.statSync(target).mode & 0o777).toBe(0o444);
      expect(fs.readFileSync(sourceFile, 'utf8')).toBe(bytes);
      expect(fs.statSync(sourceFile).mode & 0o777).toBe(0o444);
      expect(fs.readdirSync(path.dirname(target))).toEqual(['capture.json']);
    }
  });

  it.each(['upload', 'download'] as const)('%s keeps the old file and removes partial staging on copy failure', async (direction) => {
    const root = tempDir('tps-store-');
    const local = tempDir('tps-local-');
    const remote = path.join(root, 'PROJ-1');
    const source = direction === 'upload' ? local : remote;
    const destination = direction === 'upload' ? remote : local;
    writeTree(source, { 'capture.json': 'complete new bytes' });
    writeTree(destination, { 'capture.json': 'old bytes' });
    const target = path.join(destination, 'capture.json');
    const sourceFile = path.join(source, 'capture.json');
    fs.chmodSync(sourceFile, 0o444);
    fs.chmodSync(target, 0o444);
    const failure = new Error('injected partial copy failure');
    vi.spyOn(fs, 'copyFileSync').mockImplementation((_from, to) => {
      // Model a copy that has created partial output before failing.
      if (fs.existsSync(to)) fs.chmodSync(to, 0o644);
      fs.writeFileSync(to, 'partial bytes', { mode: 0o444 });
      throw failure;
    });
    const transport = new FsTransport(root);
    const transfer = direction === 'upload'
      ? transport.upload('PROJ-1', local, '')
      : transport.download('PROJ-1', '', local);
    await expect(transfer).rejects.toBe(failure);
    expect(fs.readFileSync(target, 'utf8')).toBe('old bytes');
    expect(fs.statSync(target).mode & 0o777).toBe(0o444);
    expect(fs.readFileSync(sourceFile, 'utf8')).toBe('complete new bytes');
    expect(fs.statSync(sourceFile).mode & 0o777).toBe(0o444);
    expect(fs.readdirSync(destination)).toEqual(['capture.json']);
  });

  it('keeps the old file and removes staging when replacement fails', async () => {
    const root = tempDir('tps-store-');
    const local = tempDir('tps-local-');
    writeTree(local, { 'capture.json': 'new' });
    writeTree(path.join(root, 'PROJ-1'), { 'capture.json': 'old' });
    fs.chmodSync(path.join(local, 'capture.json'), 0o444);
    const failure = new Error('injected rename failure');
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw failure; });
    await expect(new FsTransport(root).upload('PROJ-1', local, '')).rejects.toBe(failure);
    expect(fs.readFileSync(path.join(root, 'PROJ-1/capture.json'), 'utf8')).toBe('old');
    expect(fs.readdirSync(path.join(root, 'PROJ-1'))).toEqual(['capture.json']);
  });

  it('writeText updates a sealed record while preserving its mode', async () => {
    const root = tempDir('tps-store-');
    const transport = new FsTransport(root);
    await transport.writeText('PROJ-1', 'snapshot.json', 'first');
    const target = path.join(root, 'PROJ-1/snapshot.json');
    fs.chmodSync(target, 0o444);
    for (const text of ['second', 'third']) {
      await transport.writeText('PROJ-1', 'snapshot.json', text);
      expect(fs.readFileSync(target, 'utf8')).toBe(text);
      expect(fs.statSync(target).mode & 0o777).toBe(0o444);
      expect(fs.readdirSync(path.dirname(target))).toEqual(['snapshot.json']);
    }
  });

  it('writeText preserves the old record and removes partial staging on write failure', async () => {
    const root = tempDir('tps-store-');
    writeTree(path.join(root, 'PROJ-1'), { 'snapshot.json': 'old' });
    const write = fs.writeFileSync;
    const failure = new Error('injected partial write failure');
    vi.spyOn(fs, 'writeFileSync').mockImplementation((file) => {
      write(file, 'partial');
      throw failure;
    });
    await expect(new FsTransport(root).writeText('PROJ-1', 'snapshot.json', 'new')).rejects.toBe(failure);
    expect(fs.readFileSync(path.join(root, 'PROJ-1/snapshot.json'), 'utf8')).toBe('old');
    expect(fs.readdirSync(path.join(root, 'PROJ-1'))).toEqual(['snapshot.json']);
  });
});

describe('FsTransport paths', () => {
  it('rejects a ticket or relative path with an unsafe segment', async () => {
    const transport = new FsTransport(tempDir('tps-store-'));
    await expect(transport.readText('../x', 'a')).rejects.toThrow('STORE_CONFIG_INVALID');
    await expect(transport.readText('PROJ-1', '../a')).rejects.toThrow('STORE_CONFIG_INVALID');
    await expect(transport.readText('PROJ-1', 'a/./b')).rejects.toThrow('STORE_CONFIG_INVALID');
    await expect(transport.readText('PROJ-1', 'a\\b')).rejects.toThrow('STORE_CONFIG_INVALID');
  });

  it('reads a text file below the ticket and null when absent', async () => {
    const root = tempDir('tps-store-');
    writeTree(path.join(root, 'PROJ-1'), { 'stages/10-x/runs/v1/run.md': 'record\n' });
    const transport = new FsTransport(root);
    expect(await transport.readText('PROJ-1', 'stages/10-x/runs/v1/run.md')).toBe('record\n');
    expect(await transport.readText('PROJ-1', 'stages/10-x/runs/v2/run.md')).toBeNull();
    expect(fs.existsSync(path.join(root, 'PROJ-1', 'stages/10-x/runs/v2'))).toBe(false);
  });
});

describe('FsTransport download', () => {
  it('reports STORE_PACKET_MISSING when the remote path exists but is not a directory', async () => {
    const root = tempDir('tps-store-');
    fs.writeFileSync(path.join(root, 'PROJ-1'), 'a file where the packet should be\n');
    const transport = new FsTransport(root);
    await expect(transport.download('PROJ-1', '', tempDir('tps-dest-'))).rejects.toThrow('STORE_PACKET_MISSING');
    writeTree(path.join(root, 'PROJ-2'), { 'stages/10-x/README.md': 'x\n' });
    await expect(transport.download('PROJ-2', 'stages/10-x/README.md', tempDir('tps-dest-'))).rejects.toThrow(
      'STORE_PACKET_MISSING',
    );
  });
});

describe('selected', () => {
  it('rejects a runtime filter that mixes includes and excludes', () => {
    const mixed = { includes: ['/a/**'], excludes: ['/b/**'] } as unknown as TransferFilter;
    expect(() => assertFilter(mixed)).toThrow('STORE_CONFIG_INVALID');
    expect(() => selected('a/x', mixed)).toThrow('STORE_CONFIG_INVALID');
  });

  it('keeps everything without a filter', () => {
    expect(selected('stages/10-x/runs/v1/run.md')).toBe(true);
    expect(selected('stages/10-x/runs/v1/run.md', undefined)).toBe(true);
  });
  it('keeps only matches with includes', () => {
    const filter = { includes: ['/*/runs/**'] };
    expect(selected('10-x/runs/v1/run.md', filter)).toBe(true);
    expect(selected('10-x/README.md', filter)).toBe(false);
  });
  it('drops matches with excludes', () => {
    const filter = { excludes: ['/stages/*/runs/**'] };
    expect(selected('stages/10-x/runs/v1/run.md', filter)).toBe(false);
    expect(selected('stages/10-x/README.md', filter)).toBe(true);
  });
});
