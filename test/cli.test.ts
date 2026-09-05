import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path, { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TASK_PACKET_STORE_VERSION } from '../src/version.js';

const cliPath = resolve(import.meta.dirname, '..', 'dist', 'cli.js');
const commands = ['fetch', 'push', 'begin', 'checkpoint', 'pull', 'locate', 'doctor'] as const;

function runCli(args: readonly string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8', env });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function writeTree(root: string, tree: Record<string, string>): void {
  for (const [relative, text] of Object.entries(tree)) {
    const file = path.join(root, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
}

/** A temp fs store holding PROJ-1 with three identity files and one stale run, plus its config file. */
function seedStore() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tps-cli-'));
  const root = path.join(base, 'store');
  writeTree(path.join(root, 'PROJ-1'), {
    '00 Packet.md': '# p\n',
    'task.md': '# t\n',
    'jira/00 Issue.md': '# i\n',
    'stages/x/runs/v1/run.md': 'stale\n',
  });
  const store = path.join(base, 'store.json');
  fs.writeFileSync(store, JSON.stringify({ driver: 'fs', root }));
  const destination = path.join(base, 'dest');
  return { base, root, store, destination };
}

describe('cli contract', () => {
  it('--help exits 0 and names every command on stdout', () => {
    const { status, stdout } = runCli(['--help']);
    expect(status).toBe(0);
    for (const command of commands) expect(stdout).toContain(command);
  });

  it('--version exits 0 and prints the package version', () => {
    const { status, stdout, stderr } = runCli(['--version']);
    expect(status).toBe(0);
    expect(stdout).toBe(`${TASK_PACKET_STORE_VERSION}\n`);
    expect(stderr).toBe('');
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

  it.each([
    ['help', 'fetch'],
    ['fetch', '--help'],
  ])('%s %s exits 0 with the fetch usage on stdout', (...args) => {
    const { status, stdout } = runCli(args);
    expect(status).toBe(0);
    expect(stdout).toContain('Usage:');
    expect(stdout).toContain('--destination');
  });

  it('fetch with an unknown option exits 2 with an empty stdout', () => {
    const { status, stdout, stderr } = runCli(['fetch', '--nope']);
    expect(status).toBe(2);
    expect(stdout).toBe('');
    expect(stderr).toContain('error:');
  });

  it('fetch without its required options exits 2 with an empty stdout', () => {
    const { status, stdout, stderr } = runCli(['fetch']);
    expect(status).toBe(2);
    expect(stdout).toBe('');
    expect(stderr).toContain('required option');
  });

  it.each([
    ['fetch', ['--store', '--ticket', '--destination']],
    ['push', ['--store', '--ticket', '--from']],
    ['begin', ['--store', '--ticket', '--stage', '--run-key', '--tool', '--state']],
    ['checkpoint', ['--state', '--reason', '--source']],
    ['pull', ['--store', '--ticket', '--into']],
    ['doctor', ['--store']],
    ['locate', ['--store', '--ticket', '--path']],
  ] as const)('%s help lists its required options', (command, options) => {
    const { status, stdout, stderr } = runCli([command, '--help']);
    expect(status).toBe(0);
    expect(stderr).toBe('');
    for (const option of options) expect(stdout).toContain(option);
  });
});

describe('cli fetch and push against a temp fs store', () => {
  it('fetch prints one JSON line without runs and exits 0', () => {
    const { store, destination } = seedStore();
    const { status, stdout, stderr } = runCli(['fetch', '--store', store, '--ticket', 'PROJ-1', '--destination', destination]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(stdout.split('\n')).toHaveLength(2);
    const result = JSON.parse(stdout) as Record<string, unknown>;
    expect(result).toMatchObject({
      ticket: 'PROJ-1',
      driver: 'fs',
      fileCount: 3,
      packetDirectory: path.join(destination, 'PROJ-1'),
    });
    expect(result.packetSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.existsSync(path.join(destination, 'PROJ-1', 'stages'))).toBe(false);
  });

  it('fetch of a missing ticket exits 1 with one STORE_PACKET_MISSING line', () => {
    const { store, destination } = seedStore();
    const { status, stdout, stderr } = runCli(['fetch', '--store', store, '--ticket', 'PROJ-2', '--destination', destination]);
    expect(status).toBe(1);
    expect(stdout).toBe('');
    expect(stderr.startsWith('STORE_PACKET_MISSING:')).toBe(true);
    expect(stderr.trimEnd().split('\n')).toHaveLength(1);
    expect(fs.existsSync(path.join(destination, 'PROJ-2'))).toBe(false);
  });

  it('fetch with an unreadable store file exits 2 with one STORE_CONFIG_INVALID line', () => {
    const { destination } = seedStore();
    const { status, stdout, stderr } = runCli([
      'fetch',
      '--store',
      '/nonexistent.json',
      '--ticket',
      'PROJ-1',
      '--destination',
      destination,
    ]);
    expect(status).toBe(2);
    expect(stdout).toBe('');
    expect(stderr.startsWith('STORE_CONFIG_INVALID:')).toBe(true);
    expect(stderr.trimEnd().split('\n')).toHaveLength(1);
  });

  it('the gdrive driver requires exactly one credential variable', () => {
    const { base, destination } = seedStore();
    const store = path.join(base, 'gdrive.json');
    fs.writeFileSync(store, JSON.stringify({ driver: 'gdrive', sharedDriveId: '0ABcDeFgHiJkLmNoP' }));
    const env = { ...process.env };
    delete env.PACKET_STORE_DRIVE_TOKEN;
    delete env.PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS;
    const { status, stdout, stderr } = runCli(
      ['fetch', '--store', store, '--ticket', 'PROJ-1', '--destination', destination],
      env,
    );
    expect(status).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toBe(
      'STORE_AUTH_MISSING: set exactly one of PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS or PACKET_STORE_DRIVE_TOKEN\n',
    );
  });

  it('push uploads a local packet without runs and exits 0', () => {
    const { base, root, store } = seedStore();
    const from = path.join(base, 'local', 'PROJ-7');
    writeTree(from, {
      '00 Packet.md': '# p\n',
      'task.md': '# t\n',
      'jira/00 Issue.md': '# i\n',
      'stages/x/runs/v1/run.md': 'run\n',
    });
    const { status, stdout, stderr } = runCli(['push', '--store', store, '--ticket', 'PROJ-7', '--from', from]);
    expect(stderr).toBe('');
    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ ticket: 'PROJ-7', driver: 'fs', from });
    expect(fs.readFileSync(path.join(root, 'PROJ-7', 'task.md'), 'utf8')).toBe('# t\n');
    expect(fs.existsSync(path.join(root, 'PROJ-7', 'stages', 'x', 'runs'))).toBe(false);
  });

  it('runs begin, checkpoint, pull, and doctor through an fs store', () => {
    const { base, root, store } = seedStore();
    const state = path.join(base, 'state.json');
    const begun = runCli([
      'begin',
      '--store',
      store,
      '--ticket',
      'PROJ-1',
      '--stage',
      '10-recon',
      '--run-key',
      'cli-run-1',
      '--tool',
      'test@1',
      '--state',
      state,
    ]);
    expect(begun.status).toBe(0);
    expect(begun.stderr).toBe('');
    expect(JSON.parse(begun.stdout)).toMatchObject({ ticket: 'PROJ-1', stage: '10-recon', version: 'v1' });

    const source = path.join(base, 'output');
    writeTree(source, { 'delivery/report.html': '<html/>\n' });
    const checkpointed = runCli([
      'checkpoint',
      '--state',
      state,
      '--reason',
      'cli-test',
      '--source',
      source,
    ]);
    expect(checkpointed.status).toBe(0);
    expect(checkpointed.stderr).toBe('');
    expect(JSON.parse(checkpointed.stdout)).toMatchObject({ version: 'v1', reason: 'cli-test', fileCount: 1 });

    const into = path.join(base, 'local', 'PROJ-1');
    fs.mkdirSync(into, { recursive: true });
    const pulled = runCli(['pull', '--store', store, '--ticket', 'PROJ-1', '--into', into]);
    expect(pulled.status).toBe(0);
    expect(pulled.stderr).toBe('');
    expect(JSON.parse(pulled.stdout)).toMatchObject({ ticket: 'PROJ-1', driver: 'fs', into });
    expect(fs.readFileSync(path.join(into, 'stages/10-recon/runs/v1/delivery/report.html'), 'utf8')).toBe(
      '<html/>\n',
    );

    const doctor = runCli(['doctor', '--store', store]);
    expect(doctor.status).toBe(0);
    expect(doctor.stderr).toBe('');
    expect(JSON.parse(doctor.stdout)).toEqual({
      driver: 'fs',
      rclone: null,
      rcloneTested: '1.75.0',
      credential: 'none',
      remoteRoot: root,
    });
  });
});


describe('cli result locations', () => {
  it('resolves packet, run, and HTML without rclone or Drive credentials', () => {
    const { root, store } = seedStore();
    const relative = 'stages/x/runs/v1/delivery/report.html';
    writeTree(path.join(root, 'PROJ-1'), { [relative]: '<html>report</html>' });
    const env = { ...process.env, PATH: '/nonexistent' };
    delete env.PACKET_STORE_DRIVE_TOKEN;
    delete env.PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS;
    for (const [relativePath, kind] of [['', 'directory'], ['stages/x/runs/v1', 'directory'], [relative, 'file']]) {
      const result = runCli(['locate', '--store', store, '--ticket', 'PROJ-1', ...(relativePath ? ['--path', relativePath] : [])], env);
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trimEnd().split('\n')).toHaveLength(1);
      expect(JSON.parse(result.stdout)).toEqual({ ticket: 'PROJ-1', driver: 'fs', relativePath, kind, location: path.join(root, 'PROJ-1', relativePath) });
    }
  });

  it.each([['missing.html', 1, 'STORE_LOCATION_MISSING'], ['../outside', 2, 'STORE_CONFIG_INVALID']])('fails for %s with empty stdout and one error line', (relative, code, error) => {
    const { store } = seedStore();
    const result = runCli(['locate', '--store', store, '--ticket', 'PROJ-1', '--path', String(relative)]);
    expect(result.status).toBe(code);
    expect(result.stdout).toBe('');
    expect(result.stderr.startsWith(`${error}:`)).toBe(true);
    expect(result.stderr.trimEnd().split('\n')).toHaveLength(1);
  });
});
