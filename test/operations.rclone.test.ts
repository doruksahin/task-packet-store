import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { locateResult } from '../src/operations.js';
import { FsTransport } from '../src/transport.js';
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
  it('does not locate a nonexistent child when rclone lists a file as its own entry', async () => {
    const root = tempDir('tps-location-parent-');
    writeTree(path.join(root, 'PROJ-123'), { 'delivery/report.html': '<html>saved</html>' });
    const runner = createRcloneRunner({ PATH: process.env.PATH ?? '' });
    const parentFile = path.join(root, 'PROJ-123', 'delivery/report.html');
    const raw = await runner.run(['lsjson', parentFile]);
    expect(raw.code).toBe(0);
    expect(JSON.parse(raw.stdout)).toMatchObject([{ Name: 'report.html', IsDir: false }]);
    const transport = new RcloneTransport({
      run: async (args) => {
        const result = await runner.run(args);
        if (result.code !== 0) return result;
        const metadata = JSON.parse(result.stdout);
        // Keep real rclone path/type semantics; the local backend lacks only Drive object IDs.
        if (Array.isArray(metadata)) {
          for (const entry of metadata) entry.ID = 'fixture-observed-file-id';
        }
        return { ...result, stdout: JSON.stringify(metadata) };
      },
    }, (ticket) => path.join(root, ticket));
    await expect(locateResult(transport, 'PROJ-123', 'delivery/report.html/report.html'))
      .rejects.toThrow('STORE_LOCATION_MISSING');
    await expect(locateResult(new FsTransport(root), 'PROJ-123', 'delivery/report.html/report.html'))
      .rejects.toThrow('STORE_LOCATION_MISSING');
    expect(fs.readFileSync(parentFile, 'utf8')).toBe('<html>saved</html>');
  });
});

if (process.env.CI && !hasRclone) throw new Error('rclone is required in CI');
