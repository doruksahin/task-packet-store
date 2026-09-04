// Library entry point. Consumers import the digest and the operations; the CLI is a thin wrapper.
export { DEFAULT_IDENTITY, RUNS_GLOB, parseStoreConfig, readStoreConfig, type StoreConfig } from './config.js';
export { StoreError, exitCodeFor, type StoreErrorCode } from './errors.js';
export { matchesIdentity, packetSha256 } from './identity.js';
export { fetchPacket, pushPacket, type FetchResult, type PushResult } from './operations.js';
export { createTransport } from './store.js';
export { FsTransport, type PacketTransport, type TransferFilter } from './transport.js';
