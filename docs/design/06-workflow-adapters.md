# Reusing storage in another workflow

Status: implementation contract, 2026-09-05. Delivery is tracked in
[the reusable-storage plan](../plan/13-reusable-storage-contract.md).

An operator selects one credential-free store configuration and passes it to each workflow.
The workflow's adapter uses `@doruksahin/task-packet-store`; the LLM/plugin works with ordinary
input and output directories. Storage selection does not select the execution host.

## Runner contract

Every storage-enabled entry point accepts an explicit absolute `--store` configuration path and
ticket. A command that prepares a workspace also accepts an explicit absolute working-directory
path. The adapter must document its literal invocation; existing plugin command conventions may
be retained rather than introducing an unrelated command framework.

| Input | Owner | Meaning |
| --- | --- | --- |
| Store config | Operator/runner | `fs` with a persistent root, or `gdrive` with a Shared Drive/prefix |
| Ticket | Operator | Packet key, for example `PROJ-123` |
| Working directory | Runner | Fresh processing workspace, separate from the persistent store |
| Stage and tool version | Adapter | Stable stage namespace and actual tool provenance |
| Credentials | Runner environment | Existing packet-store credential contract; none for `fs` |
| Earlier run, when needed | Caller | Explicit stage/version; never silently use whichever run is newest |

Select the config once and reuse it throughout a flow. Do not create a second storage-settings
schema in a plugin. Existing no-store behavior can remain optional in a plugin such as Recon.
If an explicit store is supplied and saving fails, report failure rather than falling back silently.

## Adapter sequence

| Step | Operation | Result |
| --- | --- | --- |
| Prepare input | `fetch` | Read-only packet copy and packet digest |
| Retrieve earlier output, if required | `pull`, then select the caller's run | Previous stage files; `fetch` itself excludes runs |
| Reserve output | `begin` | Next stage version, run record, local state file |
| Process | Existing plugin/runtime | Output directory with actual generated files |
| Save progress/result | `checkpoint` | Stored output and snapshot inventory |
| Return result | `locate` | Actual file/folder locations using existing access |

A producer uses Jira export/preparation followed by `push`; a delivery-only adapter can accept
an existing rendered output directory and reserve/save it without running the LLM again.
Each adapter names its primary result file explicitly or obtains it from a validated runtime
receipt. It must not guess the filename or equate an internal runtime version with a store version.

Results identify the ticket, stage/run version, saved run location, and primary result location.
Both filesystem paths and Drive URLs are valid. A success claim requires the final save and
location lookups to succeed. Existing draft/approval semantics remain owned by the plugin.

## Ownership and boundaries

- The package continues to own transport, filtering, packet identity, version reservation,
  checkpoints, and location lookup. Reuse its published, exact pinned version.
- Each consumer owns its small adapter, application/LLM invocation, expected output validation,
  and user-facing summary. No backend branches inside processing or save operations.
- Runner bootstrap can choose whether rclone and Drive credentials are needed. LLM child
  processes do not need Drive credentials.
- Filesystem storage needs a persistent directory reachable by the execution host. A temporary
  hosted-runner directory is not durable storage across workflow runs.
- Keep the existing two Drive Actions commands working. Their wrappers should call the same
  portable processing/delivery code used by explicit-config invocations.
- Do not add a universal workflow engine, another Drive client, or new storage commands unless
  the two real consumers expose a concrete missing capability.

## Proof

Exercise the same adapter with an `fs` store and a real Shared Drive store. Verify the primary
result, supporting files, and run records through the returned location; repeat to check that
earlier output remains unchanged. Storage acceptance may use a deterministic producer or an
existing rendered bundle, clearly labeled, without claiming to prove new AC judgments.

The first two consumers are the portable packet/walkthrough runner and Recon's dossier delivery.
The second integration must use Recon's existing governance and preserve its Jira delivery and
human approval behavior. See [the acceptance plan](../plan/15-reusable-storage-acceptance.md).
