import { describe, expect, it } from 'vitest';
import { parseRunRecord, renderRunRecord } from '../src/run-record.js';

describe('run record', () => {
  it('round-trips and keeps a numeric-looking run key as a string', () => {
    const text = renderRunRecord({
      type: 'stage-run',
      jira_key: 'PROJ-123',
      stage_folder: '20-ac-walkthrough',
      stage_id: 'ac-walkthrough',
      version: 'v1',
      run_key: '17012345678',
      tool: 'ac-walkthrough@6.0.0',
      started_at: '2026-09-04T09:12:33.120Z',
    });
    expect(text.startsWith('---\n')).toBe(true);
    expect(text).toContain('# PROJ-123 · ac-walkthrough · v1');
    expect(parseRunRecord(text).run_key).toBe('17012345678');
  });

  it('rejects a record without frontmatter or with unknown keys', () => {
    expect(() => parseRunRecord('# no frontmatter\n')).toThrow('STORE_RUN_MISSING');
    expect(() => parseRunRecord('---\ntype: stage-run\nextra: 1\n---\n')).toThrow('STORE_RUN_MISSING');
    expect(() => parseRunRecord('---\ntype: [broken\n---\n')).toThrow('STORE_RUN_MISSING');
  });
});
