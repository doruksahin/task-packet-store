import fs from 'node:fs';
import path from 'node:path';
import { describe } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { FsTransport } from '../src/transport.js';
import { exerciseFetchAndPush, tempDir, writeTree, type Harness } from './operations.shared.js';

function makeFsHarness(): Harness {
  const root = tempDir('tps-store-');
  return {
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
