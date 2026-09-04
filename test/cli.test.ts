import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cliPath = resolve(import.meta.dirname, '..', 'dist', 'cli.js');
const commands = ['fetch', 'push', 'begin', 'checkpoint', 'pull', 'doctor'] as const;

function runCli(args: readonly string[]) {
  const result = spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('cli contract', () => {
  it('--help exits 0 and names every command on stdout', () => {
    const { status, stdout } = runCli(['--help']);
    expect(status).toBe(0);
    for (const command of commands) expect(stdout).toContain(command);
  });

  it.each(commands)('%s placeholder exits 1 with an empty stdout', (command) => {
    const { status, stdout, stderr } = runCli([command]);
    expect(status).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain(`${command}: not implemented`);
  });

  it('an unknown command exits 2 with an empty stdout', () => {
    const { status, stdout, stderr } = runCli(['bogus']);
    expect(status).toBe(2);
    expect(stdout).toBe('');
    expect(stderr).toContain('unknown command');
  });

  it('no arguments exits 2 and prints help to stderr', () => {
    const { status, stdout, stderr } = runCli([]);
    expect(status).toBe(2);
    expect(stdout).toBe('');
    expect(stderr).toContain('Usage:');
  });
});
