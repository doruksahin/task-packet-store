import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function usage() {
  return 'Usage: node scripts/smoke-installed-artifact.mjs <package.tgz>';
}

async function main() {
  if (process.argv.length !== 3) throw new Error(usage());

  const archive = await realpath(resolve(process.argv[2]));
  const metadata = await lstat(archive);
  if (!metadata.isFile() || !archive.endsWith('.tgz')) {
    throw new Error('Artifact must be an existing .tgz file');
  }

  const smokeRoot = await mkdtemp(join(tmpdir(), 'task-packet-store-install-'));
  try {
    await execFileAsync(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
        '--prefix',
        smokeRoot,
        archive,
      ],
      { cwd: smokeRoot, env: process.env, maxBuffer: 10 * 1024 * 1024 },
    );
    const cli = join(smokeRoot, 'node_modules', '.bin', 'task-packet-store');
    // Execute the installed bin with this Node binary so an empty PATH proves fs commands do
    // not require rclone. Runtime probes receive neither Drive credentials nor ambient options.
    const emptyPath = join(smokeRoot, 'empty-bin');
    await mkdir(emptyPath);
    const runtime = { cwd: smokeRoot, env: { PATH: emptyPath } };
    const { stdout } = await execFileAsync(process.execPath, [cli, '--help'], runtime);
    if (!stdout.includes('Usage:')) {
      throw new Error('Installed task-packet-store did not print help');
    }

    async function command(...args) {
      const result = await execFileAsync(process.execPath, [cli, ...args], runtime);
      assert.equal(result.stderr, '', `${args[0]} wrote to stderr`);
      assert.equal(result.stdout.trimEnd().split('\n').length, 1, `${args[0]} must emit one JSON line`);
      const value = JSON.parse(result.stdout);
      assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${args[0]} must emit an object`);
      return value;
    }

    const ticket = 'PROJ-123';
    const storeRoot = join(smokeRoot, 'store');
    const storeFile = join(smokeRoot, 'store.json');
    const source = join(smokeRoot, 'source');
    const stage = '20-ac-walkthrough';
    const runDirectory = `stages/${stage}/runs/v1`;
    const reportPath = `${runDirectory}/delivery/report.html`;
    const packetFiles = { '00 Packet.md': '# Packet\n', 'task.md': '# Task\n', 'jira/issue.md': '# Issue\n' };
    async function writeTree(root, files) {
      for (const [relative, text] of Object.entries(files)) {
        const target = join(root, relative);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, text);
      }
    }
    await writeFile(storeFile, JSON.stringify({ driver: 'fs', root: storeRoot }));
    await writeTree(source, {
      ...packetFiles,
      '.DS_Store': 'ignored metadata\n',
      [`${runDirectory}/delivery/stale.html`]: 'must not transfer with packet\n',
    });
    assert.deepEqual(await command('push', '--store', storeFile, '--ticket', ticket, '--from', source), {
      ticket, driver: 'fs', from: source,
    });
    await assert.rejects(lstat(join(storeRoot, ticket, runDirectory)), { code: 'ENOENT' });

    const fetched = await command('fetch', '--store', storeFile, '--ticket', ticket, '--destination', join(smokeRoot, 'fetched'));
    assert.equal(fetched.packetDirectory, join(smokeRoot, 'fetched', ticket));
    assert.equal(fetched.fileCount, 3);
    assert.match(fetched.packetSha256, /^[a-f0-9]{64}$/);
    for (const [relative, content] of Object.entries(packetFiles)) {
      assert.equal(await readFile(join(fetched.packetDirectory, relative), 'utf8'), content);
      assert.equal((await lstat(join(fetched.packetDirectory, relative))).mode & 0o222, 0);
    }

    const state = join(smokeRoot, 'state.json');
    const begun = await command('begin', '--store', storeFile, '--ticket', ticket, '--stage', stage,
      '--run-key', 'installed-smoke', '--tool', 'installed-smoke@1', '--packet-sha256', fetched.packetSha256, '--state', state);
    assert.equal(begun.version, 'v1');
    assert.equal(begun.runDirectory, runDirectory);
    const output = join(smokeRoot, 'output');
    const html = '<!doctype html><title>Installed package smoke</title>\n';
    await writeTree(output, { 'delivery/report.html': html, 'evidence/proof.txt': 'saved evidence\n' });
    const checkpointed = await command('checkpoint', '--state', state, '--reason', 'installed-smoke', '--source', output);
    assert.equal(checkpointed.version, 'v1');
    assert.equal(checkpointed.fileCount, 2);
    const pulled = await command('pull', '--store', storeFile, '--ticket', ticket, '--into', fetched.packetDirectory);
    assert.equal(pulled.into, fetched.packetDirectory);
    for (const root of [join(storeRoot, ticket), fetched.packetDirectory]) {
      assert.equal(await readFile(join(root, reportPath), 'utf8'), html);
      assert.equal(await readFile(join(root, runDirectory, 'evidence/proof.txt'), 'utf8'), 'saved evidence\n');
      const record = await readFile(join(root, runDirectory, 'run.md'), 'utf8');
      assert.ok(record.includes(`packet_sha256: ${fetched.packetSha256}`));
      const snapshot = JSON.parse(await readFile(join(root, runDirectory, 'snapshot.json'), 'utf8'));
      assert.equal(snapshot.inventorySha256, checkpointed.inventorySha256);
      assert.equal(snapshot.fileCount, 2);
    }
    for (const [relativePath, kind] of [['', 'directory'], [runDirectory, 'directory'], [reportPath, 'file']]) {
      const location = await command('locate', '--store', storeFile, '--ticket', ticket,
        ...(relativePath ? ['--path', relativePath] : []));
      assert.deepEqual(location, { ticket, driver: 'fs', relativePath, kind, location: join(storeRoot, ticket, relativePath) });
      const metadata = await lstat(location.location);
      assert.equal(metadata.isDirectory(), kind === 'directory');
    }

    // Resolve the bare library specifier from the clean install, never from this repository.
    const probe = join(smokeRoot, 'library-smoke.mjs');
    await writeFile(
      probe,
      [
        "import assert from 'node:assert/strict';",
        "const mod = await import('@doruksahin/task-packet-store');",
        `const fixture = ${JSON.stringify({ source, fetched: fetched.packetDirectory, sha256: fetched.packetSha256, storeFile, ticket, reportPath, reportLocation: join(storeRoot, ticket, reportPath) })};`,
        "assert.equal(mod.packetSha256(fixture.source, mod.DEFAULT_IDENTITY), fixture.sha256);",
        "assert.equal(mod.packetSha256(fixture.fetched, mod.DEFAULT_IDENTITY), fixture.sha256);",
        "const result = await mod.locateResult(mod.createTransport(mod.readStoreConfig(fixture.storeFile)), fixture.ticket, fixture.reportPath);",
        "assert.deepEqual(result, {ticket: fixture.ticket, driver: 'fs', relativePath: fixture.reportPath, kind: 'file', location: fixture.reportLocation});",
        "process.stdout.write('library ok\\n');",
        '',
      ].join('\n'),
    );
    const library = await execFileAsync(process.execPath, [probe], runtime);
    assert.equal(library.stdout, 'library ok\n');
    assert.equal(library.stderr, '');

    // Identity-only consumers must work even when the CLI's third-party dependencies are absent.
    // This isolated install is disposable; deleting these packages also catches accidental imports
    // of config/operations/rclone from the public identity subpath.
    for (const dependency of ['commander', 'yaml', 'zod']) {
      await rm(join(smokeRoot, 'node_modules', dependency), { recursive: true, force: true });
    }
    await writeFile(probe, [
      "import assert from 'node:assert/strict';",
      "import { packetSha256, DEFAULT_IDENTITY, matchesIdentity, regularFiles } from '@doruksahin/task-packet-store/identity';",
      `assert.equal(packetSha256(${JSON.stringify(source)}, DEFAULT_IDENTITY), ${JSON.stringify(fetched.packetSha256)});`,
      `assert.equal(packetSha256(${JSON.stringify(fetched.packetDirectory)}, DEFAULT_IDENTITY), ${JSON.stringify(fetched.packetSha256)});`,
      "assert.deepEqual(DEFAULT_IDENTITY, ['00 Packet.md', 'task.md', 'jira/**']);",
      `const sourceFiles = regularFiles(${JSON.stringify(source)}).filter(file => matchesIdentity(file.path, DEFAULT_IDENTITY));`,
      `const fetchedFiles = regularFiles(${JSON.stringify(fetched.packetDirectory)}).filter(file => matchesIdentity(file.path, DEFAULT_IDENTITY));`,
      "assert.deepEqual(sourceFiles, fetchedFiles);",
      "process.stdout.write('identity subpath ok\\n');",
      '',
    ].join('\n'));
    const identityOnly = await execFileAsync(process.execPath, [probe], runtime);
    assert.equal(identityOnly.stdout, 'identity subpath ok\n');
    assert.equal(identityOnly.stderr, '');
    process.stdout.write(`Installed package smoke passed: ${archive}\n`);
  } finally {
    await rm(smokeRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
