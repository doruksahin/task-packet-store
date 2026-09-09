import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { StoreError } from './errors.js';
import { DEFAULT_IDENTITY } from './identity-constants.js';
export { DEFAULT_IDENTITY, IGNORED_BASENAMES } from './identity-constants.js';

export const SAFE_TICKET = /^[A-Z][A-Z0-9]+-\d+$/;
export const SAFE_STAGE = /^\d{2}-[a-z][a-z0-9-]*$/;
/** One path segment: no separator, no backslash, no NUL, not `.` or `..`. */
export const SAFE_SEGMENT = /^(?!\.{1,2}$)[^/\\\0]+$/;
/** Slash-separated segments that start with a letter or digit. No leading, trailing, or doubled slash. */
export const SAFE_PREFIX = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
export const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
/** Anchored glob. Tool output lives here and is never part of fetch or push. */
export const RUNS_GLOB = '/stages/*/runs/**';

/** An exact file (`a/b.md`) or a directory subtree (`a/b/**`). Segments are SAFE_SEGMENT without `*`. */
const IdentityEntry = z
  .string()
  .regex(
    /^(?!\.{1,2}(?:\/|$))[^/\\\0*]+(?:\/(?!\.{1,2}(?:\/|$))[^/\\\0*]+)*(?:\/\*\*)?$/,
    'identity entry must be an exact file or dir/**',
  );
const identity = z.array(IdentityEntry).min(1).default([...DEFAULT_IDENTITY]);

/** A remote git can clone. `file://` is a legitimate bare remote and is how tests and CI run offline. */
const GIT_PROTOCOLS = new Set(['https:', 'ssh:', 'file:']);
const gitRemote = z
  .string()
  .refine(
    (value) => {
      try {
        return GIT_PROTOCOLS.has(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    'remote must be an https://, ssh://, or file:// URL (scp-style host:path is not accepted)',
  )
  // A username is conventional (`ssh://git@host/o/r.git`); a password is the one credential a URL
  // can carry, and the configuration file is committable. git's own credentials are the route.
  .refine(
    (value) => {
      try {
        return new URL(value).password === '';
      } catch {
        return true;
      }
    },
    'remote must not embed a password; use an SSH agent or a git credential helper',
  );

export const StoreConfigSchema = z.discriminatedUnion('driver', [
  z.strictObject({
    driver: z.literal('fs'),
    root: z.string().refine((value) => path.isAbsolute(value), 'root must be an absolute path'),
    identity,
  }),
  z.strictObject({
    driver: z.literal('gdrive'),
    sharedDriveId: z.string().regex(DRIVE_ID, 'sharedDriveId must be a Drive id'),
    prefix: z.string().regex(SAFE_PREFIX, 'prefix has no leading or trailing slash').optional(),
    identity,
  }),
  z.strictObject({
    driver: z.literal('git'),
    remote: gitRemote,
    branch: z.string().regex(SAFE_SEGMENT, 'branch must be one path segment').default('main'),
    prefix: z.string().regex(SAFE_PREFIX, 'prefix has no leading or trailing slash').optional(),
    identity,
  }),
]);

export type StoreConfig = z.infer<typeof StoreConfigSchema>;
export type FsConfig = Extract<StoreConfig, { driver: 'fs' }>;
export type GdriveConfig = Extract<StoreConfig, { driver: 'gdrive' }>;
export type GitConfig = Extract<StoreConfig, { driver: 'git' }>;

export function parseStoreConfig(value: unknown): StoreConfig {
  const result = StoreConfigSchema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues.map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`);
    throw new StoreError('STORE_CONFIG_INVALID', detail.join('; '));
  }
  return result.data;
}

export function readStoreConfig(file: string): StoreConfig {
  if (!path.isAbsolute(file)) throw new StoreError('STORE_CONFIG_INVALID', '--store must be an absolute path');
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new StoreError('STORE_CONFIG_INVALID', `cannot read ${file}: ${(error as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new StoreError('STORE_CONFIG_INVALID', `${file} is not JSON`);
  }
  return parseStoreConfig(json);
}

export function validateTicket(ticket: string): string {
  if (!SAFE_TICKET.test(ticket)) throw new StoreError('STORE_CONFIG_INVALID', `invalid ticket: ${ticket}`);
  return ticket;
}

export function validateStage(stage: string): string {
  if (!SAFE_STAGE.test(stage)) throw new StoreError('STORE_CONFIG_INVALID', `invalid stage: ${stage}`);
  return stage;
}

/** Empty means the packet itself; otherwise an exact path, never a normalized or traversing path. */
export function validateLocationPath(relativePath: string): string {
  if (
    typeof relativePath !== 'string' ||
    /[\x00-\x1f\x7f]/.test(relativePath) ||
    (relativePath !== '' && relativePath.split('/').some((segment) => !SAFE_SEGMENT.test(segment)))
  ) {
    throw new StoreError('STORE_CONFIG_INVALID', '--path must be an exact packet-relative path');
  }
  return relativePath;
}
