import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_IDENTITY } from '../src/config.js';
import { packetSha256 } from '../src/identity.js';

function write(root: string, tree: Record<string, string>): void {
  for (const [relative, text] of Object.entries(tree)) {
    const file = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}

describe('packetSha256', () => {
  it('changes with identity files and ignores runs and human stage files', () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'tps-a-'));
    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'tps-b-'));
    const identity = { '00 Packet.md': '# p\n', 'task.md': '# t\n', 'jira/00 Issue.md': '# i\n' };
    write(a, { ...identity, 'stages/20-ac-walkthrough/README.md': 'one\n' });
    write(b, { ...identity, 'stages/20-ac-walkthrough/README.md': 'two\n', 'stages/20-ac-walkthrough/runs/v1/run.md': 'x\n' });
    expect(packetSha256(a, DEFAULT_IDENTITY)).toBe(packetSha256(b, DEFAULT_IDENTITY));
    write(b, { 'jira/00 Issue.md': '# changed\n' });
    expect(packetSha256(a, DEFAULT_IDENTITY)).not.toBe(packetSha256(b, DEFAULT_IDENTITY));
  });
  it('fails when no identity file exists', () => {
    const c = fs.mkdtempSync(path.join(os.tmpdir(), 'tps-c-'));
    write(c, { 'stages/x/README.md': 'x\n' });
    expect(() => packetSha256(c, DEFAULT_IDENTITY)).toThrow('STORE_PACKET_MISSING');
  });
});
