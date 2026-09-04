#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command()
  .name('task-packet-store')
  .description('Read and write task packets from a local file system or Google Drive.')
  .showHelpAfterError();

for (const [name, summary] of [
  ['fetch', 'Download one frozen packet without runs into <destination>/<TICKET>.'],
  ['push', 'Upload one packet from a local directory, without runs.'],
  ['begin', 'Reserve the next runs/vN for a stage and write run.md.'],
  ['checkpoint', 'Upload a source directory into the reserved run and write snapshot.json.'],
  ['pull', 'Download every stages/*/runs/** into a local packet.'],
  ['doctor', 'Report rclone version, credential variables, and the resolved remote.'],
] as const) {
  program.command(name).description(summary).action(() => {
    process.stderr.write(`${name}: not implemented\n`);
    process.exitCode = 1;
  });
}

program.parseAsync(process.argv);
