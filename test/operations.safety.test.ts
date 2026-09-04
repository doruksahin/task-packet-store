import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pullRuns } from '../src/operations.js';
import type { PacketTransport } from '../src/transport.js';
import { cleanupTempDirs, tempDir, writeTree } from './operations.shared.js';

afterEach(cleanupTempDirs);

describe('pull safety boundary', () => {
  it('rejects an unsafe downloaded tree before merging any run files', async () => {
    const transport: PacketTransport = {
      driver: 'gdrive',
      download: async (_ticket, _remoteDir, localDir) => {
        writeTree(localDir, { '10-recon/runs/v1/run.md': 'safe file that must not be merged\n' });
        fs.symlinkSync('/outside', path.join(localDir, '10-recon', 'runs', 'v1', 'unsafe-link'));
      },
      upload: async () => {
        throw new Error('unreachable');
      },
      listDirectories: async () => ['10-recon'],
      readText: async () => {
        throw new Error('unreachable');
      },
      writeText: async () => {
        throw new Error('unreachable');
      },
    };
    const target = path.join(tempDir('tps-local-'), 'PROJ-1');
    writeTree(target, { 'task.md': 'local packet\n' });

    await expect(pullRuns(transport, 'PROJ-1', target)).rejects.toThrow('STORE_PACKET_UNSAFE');
    expect(fs.existsSync(path.join(target, 'stages'))).toBe(false);
    expect(fs.readFileSync(path.join(target, 'task.md'), 'utf8')).toBe('local packet\n');
  });
});
