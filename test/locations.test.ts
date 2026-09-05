import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { locateResult } from '../src/operations.js';
import { RcloneTransport, type RcloneResult } from '../src/rclone.js';
import { FsTransport } from '../src/transport.js';
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

for (const driver of ['fs', 'gdrive'] as const) {
  describe(`result location contract through ${driver}`, () => {
    function make() {
      const root = tempDir('tps-location-');
      writeTree(path.join(root, ticket), { [report]: '<html>saved report</html>' });
      const calls: string[][] = [];
      const transport = driver === 'fs' ? new FsTransport(root) : new RcloneTransport({
        run: async (args) => {
          calls.push(args);
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
      }, (key) => `:drive,team_drive=sharedDriveId:packets/${key}`);
      return { root, transport, calls };
    }

    it.each(objects)('resolves existing $kind $relativePath without writing', async (object) => {
      const h = make();
      const html = path.join(h.root, ticket, report);
      const before = fs.statSync(html);
      const result = await locateResult(h.transport, ticket, object.relativePath);
      expect(result).toEqual({
        ticket, driver, relativePath: object.relativePath, kind: object.kind,
        location: driver === 'fs' ? path.join(h.root, ticket, object.relativePath)
          : object.kind === 'directory' ? `https://drive.google.com/drive/folders/${object.id}`
          : `https://drive.google.com/file/d/${object.id}/view`,
      });
      expect(fs.readFileSync(html, 'utf8')).toBe('<html>saved report</html>');
      expect(fs.statSync(html).mtimeMs).toBe(before.mtimeMs);
      expect(h.calls.every((args) => args[0] === 'lsjson' && args.length === 2)).toBe(true);
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
    const transport = new RcloneTransport({ run: async (args) => { calls.push(args); return result; } },
      (key) => `:drive,team_drive=sharedDriveId:${prefix}${key}`);
    return { calls, transport };
  }

  it('lists a bare shared Drive root to obtain the packet ID', async () => {
    const h = make({ code: 0, stdout: JSON.stringify([{ Name: ticket, ID: 'actual-id', IsDir: true }]), stderr: '' }, '');
    expect((await locateResult(h.transport, ticket)).location).toBe('https://drive.google.com/drive/folders/actual-id');
    expect(h.calls).toEqual([['lsjson', ':drive,team_drive=sharedDriveId:']]);
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

  it('rejects invalid transport inputs before spawning rclone', async () => {
    const h = make({ code: 0, stdout: '[]', stderr: '' });
    await expect(h.transport.locate('../bad', '')).rejects.toThrow('STORE_CONFIG_INVALID');
    await expect(h.transport.locate(ticket, '../bad')).rejects.toThrow('STORE_CONFIG_INVALID');
    expect(h.calls).toEqual([]);
  });
});
