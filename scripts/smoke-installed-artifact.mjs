import { execFile } from 'node:child_process';
import { lstat, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
    const { stdout } = await execFileAsync(cli, ['--help'], {
      cwd: smokeRoot,
      env: process.env,
    });
    if (!stdout.includes('Usage:')) {
      throw new Error('Installed task-packet-store did not print help');
    }

    // Library smoke: consumers import packetSha256 from the installed package, so resolve the
    // bare specifier from the install location, not from this repository.
    const probe = join(smokeRoot, 'library-smoke.mjs');
    await writeFile(
      probe,
      [
        "const mod = await import('@doruksahin/task-packet-store');",
        "if (typeof mod.packetSha256 !== 'function') throw new Error('packetSha256 is not a function');",
        "process.stdout.write('library ok\\n');",
        '',
      ].join('\n'),
    );
    const library = await execFileAsync(process.execPath, [probe], { cwd: smokeRoot, env: process.env });
    if (!library.stdout.includes('library ok')) {
      throw new Error('Installed @doruksahin/task-packet-store did not export packetSha256');
    }
    process.stdout.write(`Installed package smoke passed: ${archive}\n`);
  } finally {
    await rm(smokeRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
