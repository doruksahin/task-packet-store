import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TASK_PACKET_STORE_VERSION } from '../../src/version.js';

const repositoryRoot = resolve('.');
const forbiddenConsumerTerms = /adc-vault|adcreative|obsidian/i;

describe('consumer-neutral package boundary', () => {
  it('keeps runtime code free of consumer-specific policy', async () => {
    const files = await sourceFiles(['src']);
    const violations: string[] = [];
    for (const file of files) {
      if (!/\.(?:ts|json)$/.test(file)) continue;
      const content = await readFile(file, 'utf8');
      if (forbiddenConsumerTerms.test(content)) violations.push(relative(repositoryRoot, file));
    }
    expect(violations).toEqual([]);
  });

  it('ships only the allowlisted package contents', async () => {
    const manifest = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8')) as { files: string[] };
    expect(manifest.files).toEqual([
      'dist',
      'README.md',
      'docs/design/03-architecture.md',
      'docs/design/04-server-operation.md',
    ]);
  });

  it('publishes the scoped MIT package while retaining the stable CLI command', async () => {
    const manifest = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8')) as {
      name: string;
      private?: boolean;
      license: string;
      engines: Record<string, string>;
      bin: Record<string, string>;
      exports: Record<string, { types: string; import: string }>;
      publishConfig: { access: string; registry: string };
    };

    expect(manifest.name).toBe('@doruksahin/task-packet-store');
    expect(manifest.private).toBeUndefined();
    expect(manifest.license).toBe('MIT');
    expect(manifest.engines).toEqual({ node: '>=20' });
    expect(manifest.bin).toEqual({
      'task-packet-store': 'dist/cli.js',
    });
    expect(manifest.exports['.']).toEqual({
      types: './dist/index.d.ts',
      import: './dist/index.js',
    });
    expect(manifest.publishConfig).toEqual({
      access: 'public',
      registry: 'https://registry.npmjs.org',
    });
  });

  it('keeps package and runtime versions aligned', async () => {
    const manifest = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8')) as { version: string };
    const releasePlease = JSON.parse(
      await readFile(join(repositoryRoot, 'release-please-config.json'), 'utf8'),
    ) as {
      packages: Record<string, { 'extra-files': Array<{ type: string; path: string }> }>;
    };
    const versionSource = await readFile(join(repositoryRoot, 'src', 'version.ts'), 'utf8');

    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    expect(TASK_PACKET_STORE_VERSION).toBe(manifest.version);
    expect(releasePlease.packages['.']?.['extra-files']).toContainEqual({
      type: 'generic',
      path: 'src/version.ts',
    });
    expect(versionSource).toContain('x-release-please-version');
  });
});

async function sourceFiles(roots: readonly string[]): Promise<string[]> {
  const files: string[] = [];
  for (const root of roots) await walk(join(repositoryRoot, root), files);
  return files;
}

async function walk(directory: string, files: string[]): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Packaged source contains a symbolic link: ${relative(repositoryRoot, path)}`);
    if (entry.isDirectory()) await walk(path, files);
    else files.push(path);
  }
}
