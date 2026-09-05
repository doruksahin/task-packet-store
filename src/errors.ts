export type StoreErrorCode =
  | 'STORE_CONFIG_INVALID'
  | 'STORE_STATE_INVALID'
  | 'STORE_AUTH_MISSING'
  | 'STORE_RCLONE_UNAVAILABLE'
  | 'STORE_RCLONE_FAILED'
  | 'STORE_PACKET_MISSING'
  | 'STORE_PACKET_UNSAFE'
  | 'STORE_DESTINATION_EXISTS'
  | 'STORE_RUN_MISSING'
  | 'STORE_LOCATION_MISSING'
  | 'STORE_VERSION_CONFLICT'
  | 'STORE_UNEXPECTED';

export class StoreError extends Error {
  readonly code: StoreErrorCode;
  constructor(code: StoreErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'StoreError';
    this.code = code;
  }
}

/** Exit 2 for caller mistakes, exit 1 for everything else. */
export function exitCodeFor(error: unknown): number {
  if (error instanceof StoreError) {
    return error.code === 'STORE_CONFIG_INVALID' || error.code === 'STORE_STATE_INVALID' ? 2 : 1;
  }
  return 1;
}

/** One `CODE: message` line for stderr. Unknown errors get a fixed code, and newlines collapse, so the failure rule holds. */
export function failureLine(error: unknown): string {
  const line =
    error instanceof StoreError ? error.message : `STORE_UNEXPECTED: ${error instanceof Error ? error.message : String(error)}`;
  return line.replace(/\s*\r?\n\s*/g, ' ');
}
