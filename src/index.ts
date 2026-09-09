// Library entry point. Consumers import the digest and the operations; the CLI is a thin wrapper.
export { DEFAULT_IDENTITY, RUNS_GLOB, parseStoreConfig, readStoreConfig, type StoreConfig } from './config.js';
export { StoreError, exitCodeFor, type StoreErrorCode } from './errors.js';
export { createGitRunner, gitEnv, GitTransport, gitVersion, type GitResult, type GitRunner } from './git.js';
export { matchesIdentity, packetSha256 } from './identity.js';
export {
  beginRun,
  checkpointRun,
  fetchPacket,
  locateResult,
  pullRuns,
  pushPacket,
  readRunState,
  type BeginInput,
  type FetchResult,
  type LocationResult,
  type PushResult,
} from './operations.js';
export {
  createRcloneRunner,
  driveRemote,
  driveRoot,
  RCLONE_TESTED_VERSION,
  rcloneEnv,
  RcloneTransport,
  rcloneVersion,
  type RcloneResult,
  type RcloneRunner,
} from './rclone.js';
export {
  parseRunRecord,
  renderRunRecord,
  RUN_KEY,
  RunRecordSchema,
  RunStateSchema,
  SnapshotSchema,
  type RunRecord,
  type RunState,
  type Snapshot,
} from './run-record.js';
export { createTransport, doctorStore } from './store.js';
export { assertFilter, FsTransport, type Driver, type PacketTransport, type ResultLocation, type TransferFilter } from './transport.js';
