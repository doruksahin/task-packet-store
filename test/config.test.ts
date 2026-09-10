import { describe, expect, it } from 'vitest';
import { DEFAULT_IDENTITY, parseStoreConfig, StoreConfigSchema, validateStage, validateTicket } from '../src/config.js';
import { DRIVERS } from '../src/transport.js';

const gdrive = { driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP' } as const;
const git = { driver: 'git', remote: 'https://github.com/team/packets.git' } as const;

describe('store config', () => {
  it('accepts exactly the exported drivers, in the exported order', () => {
    expect(StoreConfigSchema.options.map((option) => option.shape.driver.value)).toEqual([...DRIVERS]);
  });
  it('accepts an fs config and fills the default identity', () => {
    const config = parseStoreConfig({ driver: 'fs', root: '/abs/packets' });
    expect(config.identity).toEqual([...DEFAULT_IDENTITY]);
  });
  it('accepts a gdrive config', () => {
    const config = parseStoreConfig({ ...gdrive, prefix: 'packets' });
    expect(config.driver).toBe('gdrive');
  });
  it('accepts a git config and defaults the branch to main', () => {
    expect(parseStoreConfig({ ...git, prefix: 'packets' })).toMatchObject({ driver: 'git', branch: 'main' });
  });
  it.each(['https://github.com/team/packets.git', 'ssh://git@github.com/team/packets.git', 'file:///srv/packets.git'])(
    'accepts git remote %j',
    (remote) => {
      expect(parseStoreConfig({ driver: 'git', remote }).driver).toBe('git');
    },
  );
  it.each(['git@github.com:team/packets.git', 'http://github.com/team/packets.git', '/srv/packets.git', ''])(
    'rejects git remote %j',
    (remote) => {
      expect(() => parseStoreConfig({ driver: 'git', remote })).toThrow('STORE_CONFIG_INVALID');
    },
  );
  it('keeps the conventional git username but rejects an embedded password', () => {
    expect(parseStoreConfig({ driver: 'git', remote: 'ssh://git@github.com/team/packets.git' }).driver).toBe('git');
    expect(() => parseStoreConfig({ driver: 'git', remote: 'https://user:token@github.com/team/packets.git' })).toThrow(
      'remote must not embed a password; use an SSH agent or a git credential helper',
    );
  });
  it.each(['release/next', '..', '.', 'a/b'])('rejects git branch %j', (branch) => {
    expect(() => parseStoreConfig({ ...git, branch })).toThrow('STORE_CONFIG_INVALID');
  });
  it('rejects unknown keys, relative roots, and bad prefixes', () => {
    expect(() => parseStoreConfig({ driver: 'fs', root: '/abs', extra: 1 })).toThrow('STORE_CONFIG_INVALID');
    expect(() => parseStoreConfig({ driver: 'fs', root: 'relative' })).toThrow('STORE_CONFIG_INVALID');
    expect(() => parseStoreConfig({ ...gdrive, prefix: '/x/' })).toThrow('STORE_CONFIG_INVALID');
    expect(() => parseStoreConfig({ ...git, prefix: 'x/' })).toThrow('STORE_CONFIG_INVALID');
    expect(() => parseStoreConfig({ ...git, extra: 1 })).toThrow('STORE_CONFIG_INVALID');
  });
  it.each(['packets', 'a/b', 'team.x/packets-2026'])('accepts prefix %j', (prefix) => {
    expect(parseStoreConfig({ ...gdrive, prefix }).driver).toBe('gdrive');
  });
  it.each(['a/../b', 'a//b', 'a/./b', '/x', 'x/'])('rejects prefix %j', (prefix) => {
    expect(() => parseStoreConfig({ ...gdrive, prefix })).toThrow('STORE_CONFIG_INVALID');
  });
  it.each(['00 Packet.md', 'jira/**', 'docs/sub/file.md'])('accepts identity entry %j', (entry) => {
    expect(parseStoreConfig({ driver: 'fs', root: '/abs', identity: [entry] }).identity).toEqual([entry]);
  });
  it.each(['jira/*', 'jira/', 'jira/*.md', 'a//b', '**', 'jira/**/x', '../x', 'a/./b'])('rejects identity entry %j', (entry) => {
    expect(() => parseStoreConfig({ driver: 'fs', root: '/abs', identity: [entry] })).toThrow('STORE_CONFIG_INVALID');
  });
  it('validates tickets and stages', () => {
    expect(validateTicket('PROJ-123')).toBe('PROJ-123');
    expect(() => validateTicket('proj-1')).toThrow('STORE_CONFIG_INVALID');
    expect(validateStage('20-ac-walkthrough')).toBe('20-ac-walkthrough');
    expect(() => validateStage('walkthrough')).toThrow('STORE_CONFIG_INVALID');
  });
});
