import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { pushPacket } from '../src/operations.js';
import { FsTransport } from '../src/transport.js';
import { PACKET, cleanupTempDirs, exerciseFetchAndPush, tempDir, writeTree, type Harness } from './operations.shared.js';

afterEach(cleanupTempDirs);

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
