import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertFilter, FsTransport, selected, type TransferFilter } from '../src/transport.js';
import { cleanupTempDirs, tempDir, writeTree } from './operations.shared.js';

afterEach(cleanupTempDirs);

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
