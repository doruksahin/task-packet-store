#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import path from 'node:path';
import { readStoreConfig } from './config.js';
import { exitCodeFor, failureLine } from './errors.js';
import { beginRun, checkpointRun, fetchPacket, pullRuns, pushPacket, readRunState } from './operations.js';
import { createTransport, doctorStore } from './store.js';
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
      return fetchPacket(createTransport(config), config.identity, options.ticket, options.destination);
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
      return pushPacket(createTransport(config), config.identity, options.ticket, options.from);
    }),
  );

program
  .command('begin')
  .description('Reserve the next runs/vN for a stage and write run.md.')
  .requiredOption('--store <file>', 'absolute path to the store JSON')
  .requiredOption('--ticket <ticket>', 'Jira ticket, for example PROJ-123')
  .requiredOption('--stage <stage>', 'stage folder, for example 20-ac-walkthrough')
  .requiredOption('--run-key <key>', 'unique key for this tool run')
  .requiredOption('--tool <name@version>', 'tool name and version')
  .option('--packet-sha256 <hex>', 'packet identity digest')
  .requiredOption('--state <file>', 'absolute path for the new run state file')
  .action(
    (
      options: StoreOptions & {
        stage: string;
        runKey: string;
        tool: string;
        packetSha256?: string;
        state: string;
      },
    ) =>
      run(async () => {
        const config = readStoreConfig(options.store);
        return beginRun(createTransport(config), {
          ticket: options.ticket,
          stage: options.stage,
          runKey: options.runKey,
          tool: options.tool,
          ...(options.packetSha256 ? { packetSha256: options.packetSha256 } : {}),
          stateFile: options.state,
          storeFile: path.resolve(options.store),
        });
      }),
  );

program
  .command('checkpoint')
  .description('Upload a source directory into the reserved run and write snapshot.json.')
  .requiredOption('--state <file>', 'absolute path to the run state file')
  .requiredOption('--reason <text>', 'checkpoint reason')
  .requiredOption('--source <dir>', 'absolute directory containing run output')
  .action((options: { state: string; reason: string; source: string }) =>
    run(async () => {
      const state = readRunState(options.state);
      const config = readStoreConfig(state.storeFile);
      return checkpointRun(createTransport(config), state, options.state, options.reason, options.source);
    }),
  );

program
  .command('pull')
  .description('Download every stages/*/runs/** into a local packet.')
  .requiredOption('--store <file>', 'absolute path to the store JSON')
  .requiredOption('--ticket <ticket>', 'Jira ticket, for example PROJ-123')
  .requiredOption('--into <dir>', 'absolute local packet directory')
  .action((options: StoreOptions & { into: string }) =>
    run(async () => {
      const config = readStoreConfig(options.store);
      return pullRuns(createTransport(config), options.ticket, options.into);
    }),
  );

program
  .command('doctor')
  .description('Report rclone version, credential variables, and the resolved remote.')
  .requiredOption('--store <file>', 'absolute path to the store JSON')
  .action((options: { store: string }) =>
    run(async () => {
      const config = readStoreConfig(options.store);
      return doctorStore(config);
    }),
  );

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (!(error instanceof CommanderError)) throw error;
  // Commander has already written its message (and help, via showHelpAfterError) to stderr.
  // Help and version requests exit 0. Every usage error is exit 2 per the CLI contract.
  process.exitCode = error.exitCode === 0 ? 0 : 2;
}
