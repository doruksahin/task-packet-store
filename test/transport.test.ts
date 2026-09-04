import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FsTransport } from '../src/transport.js';
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
