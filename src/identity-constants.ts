export const DEFAULT_IDENTITY = ['00 Packet.md', 'task.md', 'jira/**'] as const;
/** Basenames that no walk sees: they never enter a digest or a transfer. */
export const IGNORED_BASENAMES: ReadonlySet<string> = new Set(['.DS_Store']);
