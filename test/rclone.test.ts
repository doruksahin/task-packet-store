import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { RCLONE_TESTED_VERSION, driveRemote, rcloneEnv } from '../src/rclone.js';

describe('rclone env', () => {
  it('requires exactly one credential variable', () => {
    expect(() => rcloneEnv({})).toThrow('STORE_AUTH_MISSING');
    expect(() =>
      rcloneEnv({
        PACKET_STORE_DRIVE_TOKEN: 'a',
        PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS: 'b',
      }),
    ).toThrow('STORE_AUTH_MISSING');
  });

  it('maps the token, strips ambient rclone variables, and sets the scope', () => {
    const env = rcloneEnv({
      PATH: '/bin',
      RCLONE_CONFIG: '/etc/rclone.conf',
      PACKET_STORE_DRIVE_TOKEN: '{"t":1}',
    });
    expect(env).toEqual({ PATH: '/bin', RCLONE_DRIVE_SCOPE: 'drive', RCLONE_DRIVE_TOKEN: '{"t":1}' });
  });

  it('maps the service account inline', () => {
    const env = rcloneEnv({
      PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS: '{"type":"service_account"}',
    });
    expect(env.RCLONE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS).toBe('{"type":"service_account"}');
    expect(env.PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS).toBeUndefined();
  });
});

describe('drive remote', () => {
  it('builds a connection string with and without a prefix', () => {
    const withPrefix = parseStoreConfig({
      driver: 'gdrive',
      sharedDriveId: '0ABcDeFgHiJkLmNoP',
      prefix: 'packets',
    });
    const bare = parseStoreConfig({ driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP' });
    if (withPrefix.driver !== 'gdrive' || bare.driver !== 'gdrive') throw new Error('unreachable');
    expect(driveRemote(withPrefix, 'PROJ-1')).toBe(':drive,team_drive=0ABcDeFgHiJkLmNoP:packets/PROJ-1');
    expect(driveRemote(bare, 'PROJ-1')).toBe(':drive,team_drive=0ABcDeFgHiJkLmNoP:PROJ-1');
  });
});

describe('rclone version pin', () => {
  it('matches the composite action default', () => {
    const action = fs.readFileSync(path.resolve('.github/actions/install-rclone/action.yml'), 'utf8');
    expect(action).toContain(`default: v${RCLONE_TESTED_VERSION}`);
  });
});
