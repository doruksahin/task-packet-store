import type { StoreConfig } from './config.js';
import { StoreError } from './errors.js';
import { FsTransport, type PacketTransport } from './transport.js';

export function createTransport(config: StoreConfig, env: NodeJS.ProcessEnv = process.env): PacketTransport {
  if (config.driver === 'fs') return new FsTransport(config.root);
  throw new StoreError('STORE_CONFIG_INVALID', `driver ${config.driver} is not available in this version`);
}
