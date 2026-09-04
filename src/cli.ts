#!/usr/bin/env node
import { Command, CommanderError } from 'commander';

const program = new Command()
  .name('task-packet-store')
  .description('Read and write task packets from a local file system or Google Drive.')
  .showHelpAfterError()
  .exitOverride();

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

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (!(error instanceof CommanderError)) throw error;
  // Commander has already written its message (and help, via showHelpAfterError) to stderr.
  // Help and version requests exit 0. Every usage error is exit 2 per the CLI contract.
  process.exitCode = error.exitCode === 0 ? 0 : 2;
}
