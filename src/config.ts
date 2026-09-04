import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { StoreError } from './errors.js';

export const SAFE_TICKET = /^[A-Z][A-Z0-9]+-\d+$/;
export const SAFE_STAGE = /^\d{2}-[a-z][a-z0-9-]*$/;
/** One path segment: no separator, no backslash, no NUL, not `.` or `..`. */
export const SAFE_SEGMENT = /^(?!\.{1,2}$)[^/\\\0]+$/;
/** Slash-separated segments that start with a letter or digit. No leading, trailing, or doubled slash. */
export const SAFE_PREFIX = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
export const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
/** Anchored glob. Tool output lives here and is never part of fetch or push. */
export const RUNS_GLOB = '/stages/*/runs/**';
export const DEFAULT_IDENTITY = ['00 Packet.md', 'task.md', 'jira/**'] as const;
/** Basenames that no walk sees: they never enter a digest or a transfer. */
export const IGNORED_BASENAMES: ReadonlySet<string> = new Set(['.DS_Store']);

/** An exact file (`a/b.md`) or a directory subtree (`a/b/**`). Segments are SAFE_SEGMENT without `*`. */
const IdentityEntry = z
  .string()
  .regex(
    /^(?!\.{1,2}(?:\/|$))[^/\\\0*]+(?:\/(?!\.{1,2}(?:\/|$))[^/\\\0*]+)*(?:\/\*\*)?$/,
    'identity entry must be an exact file or dir/**',
  );
const identity = z.array(IdentityEntry).min(1).default([...DEFAULT_IDENTITY]);

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
]);

export type StoreConfig = z.infer<typeof StoreConfigSchema>;
export type FsConfig = Extract<StoreConfig, { driver: 'fs' }>;
export type GdriveConfig = Extract<StoreConfig, { driver: 'gdrive' }>;

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
