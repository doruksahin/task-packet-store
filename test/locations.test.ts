import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseStoreConfig } from '../src/config.js';
import { createGitRunner, GitTransport, gitEnv } from '../src/git.js';
import { locateResult } from '../src/operations.js';
import { RcloneTransport, type RcloneResult } from '../src/rclone.js';
import { FsTransport, type Driver, type PacketTransport } from '../src/transport.js';
import { cleanupTempDirs, tempDir, writeTree } from './operations.shared.js';

afterEach(cleanupTempDirs);
const ticket = 'PROJ-123';
const run = 'stages/20-ac-walkthrough/runs/v1';
const report = `${run}/delivery/report with spaces: final.html`;
const objects = [
  { relativePath: '', kind: 'directory', id: 'packet_observed_ID' },
  { relativePath: run, kind: 'directory', id: 'run_observed_ID' },
  { relativePath: report, kind: 'file', id: 'html_observed_ID' },
] as const;

interface LocationFixture {
  root: string;
  transport: PacketTransport;
  /** Backend invocations: a lookup must make only read-only ones, and a rejected path must make none. */
  calls: string[][];
  /** The location this driver must report for one seeded object. */
  location(object: (typeof objects)[number]): string;
  readOnly(args: string[]): boolean;
}

function seedRoot(): string {
  const root = tempDir('tps-location-');
  writeTree(path.join(root, ticket), { [report]: '<html>saved report</html>' });
  return root;
}

/** Publish the seeded root as the `main` branch of a fresh bare repository, and return remote and commit. */
function publish(root: string): { remote: string; commit: string } {
  const env = { PATH: process.env.PATH ?? '' };
  const bare = tempDir('tps-bare-');
  const remote = `file://${bare}`;
  const git = (args: string[]) => {
    const result = spawnSync('git', args, { encoding: 'utf8', env });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    return result.stdout;
  };
  git(['init', '--bare', '--initial-branch=main', bare]);
  git(['init', '--initial-branch=main', root]);
  git(['-C', root, 'remote', 'add', 'origin', remote]);
  git(['-C', root, 'add', '--', ticket]);
  git(['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@localhost', '-c', 'commit.gpgsign=false', 'commit', '-m', 'seed']);
  git(['-C', root, 'push', 'origin', 'HEAD:main']);
  return { remote, commit: git(['-C', bare, 'rev-parse', 'main']).trim() };
}

const fixtures: Record<Driver, () => LocationFixture> = {
  fs: () => {
    const root = seedRoot();
    return {
      root,
      transport: new FsTransport(root),
      calls: [],
      location: (object) => path.join(root, ticket, object.relativePath),
      readOnly: () => true,
    };
  },
  gdrive: () => {
    const root = seedRoot();
    const calls: string[][] = [];
    return {
      root,
      calls,
      transport: new RcloneTransport({
        run: async (args) => {
          calls.push(args);
          if (args[1] === '--stat') return { code: 0, stdout: '{"IsDir":true}', stderr: '' };
          // rclone listing fixture: distinct observed IDs, not IDs inferred from path names.
          const listing = objects.filter((object) => {
            const full = object.relativePath ? `${ticket}/${object.relativePath}` : ticket;
            const parent = full.includes('/') ? full.slice(0, full.lastIndexOf('/')) : '';
            return args[1] === `:drive,team_drive=sharedDriveId:packets/${parent}`;
          }).map((object) => ({
            Name: object.relativePath.split('/').pop() || ticket,
            IsDir: object.kind === 'directory', ID: object.id,
          }));
          return { code: 0, stdout: JSON.stringify(listing), stderr: '' };
        },
      }, (key) => `:drive,team_drive=sharedDriveId:packets/${key}`),
      location: (object) => object.kind === 'directory'
        ? `https://drive.google.com/drive/folders/${object.id}`
        : `https://drive.google.com/file/d/${object.id}/view`,
      readOnly: (args) => args[0] === 'lsjson' && (args.length === 2 || args[1] === '--stat'),
    };
  },
  git: () => {
    const root = seedRoot();
    const { remote, commit } = publish(root);
    const config = parseStoreConfig({ driver: 'git', remote });
    if (config.driver !== 'git') throw new Error('unreachable');
    const calls: string[][] = [];
    const runner = createGitRunner(gitEnv({ PATH: process.env.PATH ?? '' }));
    return {
      root,
      calls,
      transport: new GitTransport({
        run: (args, cwd) => {
          calls.push(args);
          return runner.run(args, cwd);
        },
      }, config),
      location: (object) => [`${remote}#${commit}:${ticket}`, object.relativePath].filter(Boolean).join('/'),
      readOnly: (args) => args[0] === 'clone' || args[2] === 'rev-parse',
    };
  },
};

for (const driver of ['fs', 'gdrive', 'git'] as const) {
  describe(`result location contract through ${driver}`, () => {
    const make = fixtures[driver];

    it.each(objects)('resolves existing $kind $relativePath without writing', async (object) => {
      const h = make();
      const html = path.join(h.root, ticket, report);
      const before = fs.statSync(html);
      const result = await locateResult(h.transport, ticket, object.relativePath);
      expect(result).toEqual({
        ticket, driver, relativePath: object.relativePath, kind: object.kind, location: h.location(object),
      });
      expect(fs.readFileSync(html, 'utf8')).toBe('<html>saved report</html>');
      expect(fs.statSync(html).mtimeMs).toBe(before.mtimeMs);
      expect(h.calls.every((args) => h.readOnly(args))).toBe(true);
    });

    it('defaults to the packet folder', async () => {
      const h = make();
      expect(await locateResult(h.transport, ticket)).toMatchObject({ relativePath: '', kind: 'directory' });
    });

    it.each(['missing.html', `${run}/delivery/missing.html`, 'absent/parent/report.html'])('fails for missing %s', async (relative) => {
      const h = make();
      await expect(locateResult(h.transport, ticket, relative)).rejects.toThrow('STORE_LOCATION_MISSING');
    });

    it('fails for a missing packet', async () => {
      const h = make();
      await expect(locateResult(h.transport, 'PROJ-999')).rejects.toThrow('STORE_LOCATION_MISSING');
    });

    it.each(['/etc/passwd', '../outside', 'a/../b', '.', 'a/./b', 'a//b', 'a/', 'a\\b', 'a\0b', 'a\nb'])('rejects unsafe path %j before lookup', async (relative) => {
      const h = make();
      await expect(locateResult(h.transport, ticket, relative)).rejects.toThrow('STORE_CONFIG_INVALID');
      expect(h.calls).toEqual([]);
    });
  });
}

describe('fs location safety', () => {
  it.each(['ticket', 'ancestor', 'file'])('rejects a symlink at the %s', async (where) => {
    const root = tempDir('tps-location-');
    const outside = tempDir('tps-outside-');
    writeTree(outside, { 'report.html': 'outside' });
    const target = where === 'ticket' ? path.join(root, ticket)
      : path.join(root, ticket, where === 'ancestor' ? 'delivery' : 'report.html');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(where === 'file' ? path.join(outside, 'report.html') : outside, target);
    const relative = where === 'ticket' ? '' : where === 'ancestor' ? 'delivery/report.html' : 'report.html';
    await expect(locateResult(new FsTransport(root), ticket, relative)).rejects.toThrow('STORE_PACKET_UNSAFE');
  });

  it('accepts a configured root alias and reports missing below an ordinary file', async () => {
    const root = tempDir('tps-location-');
    writeTree(path.join(root, ticket), { 'report.html': 'html' });
    const alias = path.join(tempDir('tps-alias-'), 'store');
    fs.symlinkSync(root, alias);
    const transport = new FsTransport(alias);
    expect((await locateResult(transport, ticket)).location).toBe(path.join(alias, ticket));
    await expect(locateResult(transport, ticket, 'report.html/child')).rejects.toThrow('STORE_LOCATION_MISSING');
  });
});

describe('rclone location metadata', () => {
  function make(result: RcloneResult, prefix = 'packets/') {
    const calls: string[][] = [];
    const transport = new RcloneTransport({ run: async (args) => {
      calls.push(args);
      return args[1] === '--stat' ? { code: 0, stdout: '{"IsDir":true}', stderr: '' } : result;
    } },
      (key) => `:drive,team_drive=sharedDriveId:${prefix}${key}`);
    return { calls, transport };
  }

  it('lists a bare shared Drive root to obtain the packet ID', async () => {
    const h = make({ code: 0, stdout: JSON.stringify([{ Name: ticket, ID: 'actual-id', IsDir: true }]), stderr: '' }, '');
    expect((await locateResult(h.transport, ticket)).location).toBe('https://drive.google.com/drive/folders/actual-id');
    expect(h.calls).toEqual([
      ['lsjson', '--stat', ':drive,team_drive=sharedDriveId:'],
      ['lsjson', ':drive,team_drive=sharedDriveId:'],
    ]);
  });

  it.each([3, 4])('maps missing parent exit %i to missing location', async (code) => {
    await expect(locateResult(make({ code, stdout: '', stderr: 'missing' }).transport, ticket)).rejects.toThrow('STORE_LOCATION_MISSING');
  });

  it.each([
    'not json', 'null', '{}', '[null]', '[{}]',
    JSON.stringify([{ Name: ticket, IsDir: true }]),
    JSON.stringify([{ Name: ticket, ID: 'id', IsDir: 'true' }]),
    JSON.stringify([{ Name: ticket, ID: 'id/unsafe', IsDir: false }]),
    JSON.stringify([{ Name: ticket, ID: 'one', IsDir: true }, { Name: ticket, ID: 'two', IsDir: true }]),
  ])('fails closed for unusable metadata %s', async (stdout) => {
    await expect(locateResult(make({ code: 0, stdout, stderr: '' }).transport, ticket)).rejects.toThrow('STORE_RCLONE_FAILED');
  });

  it('preserves non-missing rclone failures', async () => {
    await expect(locateResult(make({ code: 5, stdout: '', stderr: 'permission denied' }).transport, ticket)).rejects.toThrow('STORE_RCLONE_FAILED');
  });

  it.each(['null', '{}', '[]', 'true', 'not json', '{"IsDir":"true"}'])('rejects invalid parent stat %s', async (stdout) => {
    const transport = new RcloneTransport({ run: async () => ({ code: 0, stdout, stderr: '' }) }, (key) => `:drive:${key}`);
    await expect(locateResult(transport, ticket, report)).rejects.toThrow('STORE_RCLONE_FAILED');
  });

  it.each([3, 4, 5])('handles parent stat exit %i', async (code) => {
    const transport = new RcloneTransport({ run: async () => ({ code, stdout: '', stderr: 'stat failed' }) }, (key) => `:drive:${key}`);
    await expect(locateResult(transport, ticket, report)).rejects.toThrow(code === 5 ? 'STORE_RCLONE_FAILED' : 'STORE_LOCATION_MISSING');
  });

  it('does not list a file parent even when its name matches the requested child', async () => {
    const calls: string[][] = [];
    const transport = new RcloneTransport({ run: async (args) => {
      calls.push(args);
      return { code: 0, stdout: '{"Name":"report.html","IsDir":false,"ID":"actual-file-id"}', stderr: '' };
    } }, (key) => `:drive:${key}`);
    await expect(locateResult(transport, ticket, 'delivery/report.html/report.html')).rejects.toThrow('STORE_LOCATION_MISSING');
    expect(calls).toEqual([['lsjson', '--stat', `:drive:${ticket}/delivery/report.html`]]);
  });

  it('rejects invalid transport inputs before spawning rclone', async () => {
    const h = make({ code: 0, stdout: '[]', stderr: '' });
    await expect(h.transport.locate('../bad', '')).rejects.toThrow('STORE_CONFIG_INVALID');
    await expect(h.transport.locate(ticket, '../bad')).rejects.toThrow('STORE_CONFIG_INVALID');
    expect(h.calls).toEqual([]);
  });
});
