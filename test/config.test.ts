import { describe, expect, it } from 'vitest';
import { DEFAULT_IDENTITY, parseStoreConfig, validateStage, validateTicket } from '../src/config.js';

const gdrive = { driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP' } as const;

describe('store config', () => {
  it('accepts an fs config and fills the default identity', () => {
    const config = parseStoreConfig({ driver: 'fs', root: '/abs/packets' });
    expect(config.identity).toEqual([...DEFAULT_IDENTITY]);
  });
  it('accepts a gdrive config', () => {
    const config = parseStoreConfig({ ...gdrive, prefix: 'packets' });
    expect(config.driver).toBe('gdrive');
  });
  it('rejects unknown keys, relative roots, and bad prefixes', () => {
    expect(() => parseStoreConfig({ driver: 'fs', root: '/abs', extra: 1 })).toThrow('STORE_CONFIG_INVALID');
    expect(() => parseStoreConfig({ driver: 'fs', root: 'relative' })).toThrow('STORE_CONFIG_INVALID');
    expect(() => parseStoreConfig({ ...gdrive, prefix: '/x/' })).toThrow('STORE_CONFIG_INVALID');
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
