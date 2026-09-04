import { describe, expect, it } from 'vitest';
import { DEFAULT_IDENTITY, parseStoreConfig, validateStage, validateTicket } from '../src/config.js';

describe('store config', () => {
  it('accepts an fs config and fills the default identity', () => {
    const config = parseStoreConfig({ driver: 'fs', root: '/abs/packets' });
    expect(config.identity).toEqual([...DEFAULT_IDENTITY]);
  });
  it('accepts a gdrive config', () => {
    const config = parseStoreConfig({ driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP', prefix: 'packets' });
    expect(config.driver).toBe('gdrive');
  });
  it('rejects unknown keys, relative roots, and bad prefixes', () => {
    expect(() => parseStoreConfig({ driver: 'fs', root: '/abs', extra: 1 })).toThrow('STORE_CONFIG_INVALID');
    expect(() => parseStoreConfig({ driver: 'fs', root: 'relative' })).toThrow('STORE_CONFIG_INVALID');
    expect(() => parseStoreConfig({ driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP', prefix: '/x/' })).toThrow('STORE_CONFIG_INVALID');
  });
  it('validates tickets and stages', () => {
    expect(validateTicket('PROJ-123')).toBe('PROJ-123');
    expect(() => validateTicket('proj-1')).toThrow('STORE_CONFIG_INVALID');
    expect(validateStage('20-ac-walkthrough')).toBe('20-ac-walkthrough');
    expect(() => validateStage('walkthrough')).toThrow('STORE_CONFIG_INVALID');
  });
});
