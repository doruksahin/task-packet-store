import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { locateResult } from '../src/operations.js';
import { createRcloneRunner, RcloneTransport } from '../src/rclone.js';
import {
  cleanupTempDirs,
  exerciseFetchAndPush,
  exerciseRuns,
  tempDir,
  writeTree,
  type Harness,
} from './operations.shared.js';

const hasRclone = spawnSync('rclone', ['version'], { stdio: 'ignore' }).status === 0;

afterEach(cleanupTempDirs);

function makeRcloneHarness(): Harness {
  const remoteRoot = tempDir('tps-remote-');
  const runner = createRcloneRunner({ PATH: process.env.PATH ?? '' });
  return {
    transport: new RcloneTransport(runner, (ticket) => path.join(remoteRoot, ticket)),
    config: parseStoreConfig({ driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP' }),
    seed: (ticket, tree) => writeTree(path.join(remoteRoot, ticket), tree),
    remoteFile: (ticket, relative) => {
      const file = path.join(remoteRoot, ticket, ...relative.split('/'));
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    },
  };
}

describe.skipIf(!hasRclone)('operations through RcloneTransport (local backend)', () => {
  exerciseFetchAndPush(makeRcloneHarness);
  exerciseRuns(makeRcloneHarness);
  it('location lookup distinguishes missing objects from a backend without Drive IDs', async () => {
    const h = makeRcloneHarness();
    h.seed('PROJ-123', { 'delivery/report.html': '<html>saved</html>' });
    await expect(locateResult(h.transport, 'PROJ-999')).rejects.toThrow('STORE_LOCATION_MISSING');
    await expect(locateResult(h.transport, 'PROJ-123', 'missing.html')).rejects.toThrow('STORE_LOCATION_MISSING');
    await expect(locateResult(h.transport, 'PROJ-123')).rejects.toThrow('STORE_RCLONE_FAILED');
    await expect(locateResult(h.transport, 'PROJ-123', 'delivery/report.html')).rejects.toThrow('STORE_RCLONE_FAILED');
    expect(h.remoteFile('PROJ-123', 'delivery/report.html')).toBe('<html>saved</html>');
  });
});

if (process.env.CI && !hasRclone) throw new Error('rclone is required in CI');
