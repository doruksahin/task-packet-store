import { describe, expect, it } from 'vitest';
import { matchesAny, matchesGlob } from '../src/glob.js';

describe('anchored glob', () => {
  it('matches runs below any stage', () => {
    expect(matchesGlob('/stages/*/runs/**', 'stages/20-ac-walkthrough/runs/v1/run.md')).toBe(true);
    expect(matchesGlob('/stages/*/runs/**', 'stages/20-ac-walkthrough/README.md')).toBe(false);
    expect(matchesGlob('/stages/*/runs/**', 'other/stages/x/runs/y')).toBe(false);
  });
  it('matches relative to the given root', () => {
    expect(matchesGlob('/*/runs/**', '20-ac-walkthrough/runs/v1/input/notes.md')).toBe(true);
    expect(matchesGlob('/run.md', 'run.md')).toBe(true);
    expect(matchesGlob('/run.md', 'input/run.md')).toBe(false);
  });
  it('requires anchored patterns', () => {
    expect(() => matchesGlob('stages/**', 'stages/x')).toThrow('anchored');
    expect(matchesAny(undefined, 'a')).toBe(false);
  });
  it('rejects a segment that mixes a star with other characters', () => {
    expect(() => matchesGlob('/*.tmp', 'a.tmp')).toThrow('glob segment must be a literal, "*", or "**"');
    expect(() => matchesGlob('/stages/2*/runs/**', 'stages/20-x/runs/v1')).toThrow(
      'glob segment must be a literal, "*", or "**"',
    );
    expect(() => matchesAny(['/ok/**', '/bad/***'], 'ok/x')).toThrow('glob segment must be a literal, "*", or "**"');
  });
});
