#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { readStoreConfig } from './config.js';
import { exitCodeFor, failureLine } from './errors.js';
import { fetchPacket, pushPacket } from './operations.js';
import { createTransport } from './store.js';
import { TASK_PACKET_STORE_VERSION } from './version.js';

const program = new Command()
  .name('task-packet-store')
  .description('Read and write task packets from a local file system or Google Drive.')
  .version(TASK_PACKET_STORE_VERSION, '-V, --version')
  .showHelpAfterError()
  .exitOverride();

function emit(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

/** Success: one JSON object on stdout. Failure: empty stdout, one `CODE: message` line on stderr. */
async function run(action: () => Promise<unknown>): Promise<void> {
  try {
    emit(await action());
  } catch (error) {
    process.stderr.write(`${failureLine(error)}\n`);
    process.exitCode = exitCodeFor(error);
  }
}

interface StoreOptions {
  store: string;
  ticket: string;
}

program
  .command('fetch')
  .description('Download one frozen packet without runs into <destination>/<TICKET>.')
  .requiredOption('--store <file>', 'absolute path to the store JSON')
  .requiredOption('--ticket <ticket>', 'Jira ticket, for example PROJ-123')
  .requiredOption('--destination <dir>', 'absolute directory that receives <TICKET>')
  .action((options: StoreOptions & { destination: string }) =>
    run(async () => {
      const config = readStoreConfig(options.store);
      return fetchPacket(createTransport(config), config, options.ticket, options.destination);
    }),
  );

program
  .command('push')
  .description('Upload one packet from a local directory, without runs.')
  .requiredOption('--store <file>', 'absolute path to the store JSON')
  .requiredOption('--ticket <ticket>', 'Jira ticket, for example PROJ-123')
  .requiredOption('--from <dir>', 'absolute local packet directory')
  .action((options: StoreOptions & { from: string }) =>
    run(async () => {
      const config = readStoreConfig(options.store);
      return pushPacket(createTransport(config), config, options.ticket, options.from);
    }),
  );

for (const [name, summary] of [
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
