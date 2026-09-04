import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('cli', () => {
  it('prints help that names every command', () => {
    const help = execFileSync('node', ['dist/cli.js', '--help'], { encoding: 'utf8' });
    for (const command of ['fetch', 'push', 'begin', 'checkpoint', 'pull', 'doctor']) {
      expect(help).toContain(command);
    }
  });
});
