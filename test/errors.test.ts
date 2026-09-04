import { describe, expect, it } from 'vitest';
import { StoreError, exitCodeFor, failureLine } from '../src/errors.js';

describe('failureLine', () => {
  it('prints a StoreError as CODE: message', () => {
    expect(failureLine(new StoreError('STORE_PACKET_MISSING', 'no PROJ-1'))).toBe('STORE_PACKET_MISSING: no PROJ-1');
  });
  it('wraps unknown errors in STORE_UNEXPECTED', () => {
    expect(failureLine(new Error('boom'))).toBe('STORE_UNEXPECTED: boom');
    expect(failureLine('text')).toBe('STORE_UNEXPECTED: text');
  });
  it('collapses newlines so stderr stays one line', () => {
    expect(failureLine(new Error('line one\nline two'))).toBe('STORE_UNEXPECTED: line one line two');
    expect(failureLine(new Error('a  \r\n   b\n\nc'))).toBe('STORE_UNEXPECTED: a b c');
    expect(failureLine(new StoreError('STORE_CONFIG_INVALID', 'first\nsecond'))).toBe('STORE_CONFIG_INVALID: first second');
  });
});

describe('exitCodeFor', () => {
  it('is 2 for caller mistakes and 1 for everything else', () => {
    expect(exitCodeFor(new StoreError('STORE_CONFIG_INVALID', 'x'))).toBe(2);
    expect(exitCodeFor(new StoreError('STORE_STATE_INVALID', 'x'))).toBe(2);
    expect(exitCodeFor(new StoreError('STORE_PACKET_MISSING', 'x'))).toBe(1);
    expect(exitCodeFor(new Error('x'))).toBe(1);
  });
});
