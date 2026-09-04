import type { StoreConfig } from './config.js';
import {
  createRcloneRunner,
  driveRemote,
  driveRoot,
  RCLONE_TESTED_VERSION,
  rcloneEnv,
  RcloneTransport,
  rcloneVersion,
} from './rclone.js';
import { FsTransport, type PacketTransport } from './transport.js';

export function createTransport(config: StoreConfig, env: NodeJS.ProcessEnv = process.env): PacketTransport {
  if (config.driver === 'fs') return new FsTransport(config.root);
  return new RcloneTransport(createRcloneRunner(rcloneEnv(env)), (ticket) => driveRemote(config, ticket));
}

export async function doctorStore(config: StoreConfig, env: NodeJS.ProcessEnv = process.env) {
  if (config.driver === 'fs') {
    return {
      driver: config.driver,
      rclone: null,
      rcloneTested: RCLONE_TESTED_VERSION,
      credential: 'none',
      remoteRoot: config.root,
    };
  }
  const runner = createRcloneRunner(rcloneEnv(env));
  return {
    driver: config.driver,
    rclone: await rcloneVersion(runner),
    rcloneTested: RCLONE_TESTED_VERSION,
    credential: env.PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS
      ? 'PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS'
      : 'PACKET_STORE_DRIVE_TOKEN',
    remoteRoot: driveRoot(config),
  };
}
