# Connect another workflow to packet storage

Use `@doruksahin/task-packet-store` to obtain input files and save generated output. Your workflow
receives an ordinary packet directory and writes an ordinary output directory. A small adapter
connects those directories to the selected persistent store.

## 1. Select the store once

Keep a credential-free JSON file on the execution host. Every stage receives its absolute path as
`--store`; each stage uses the same file when it belongs to the same flow.

Filesystem example, `/config/store-local.json`:

```json
{
  "driver": "fs",
  "root": "/data/task-packets"
}
```

Shared Drive example, `/config/store-drive.json`:

```json
{
  "driver": "gdrive",
  "sharedDriveId": "0ABcDeFgHiJkLmNoPqR",
  "prefix": "packets"
}
```

Use your actual directory or Shared Drive ID. The processing host needs access to that location.
For `fs`, the directory must survive between runs. For Drive, the host also needs pinned rclone
and one of the existing [credential environment variables](design/03-architecture.md#credentials).
Storage selection does not choose which computer or server executes the LLM.

## 2. Give the adapter a small contract

| Input | Example | Purpose |
| --- | --- | --- |
| Store config | `/config/store-local.json` | Select where the packet and output persist |
| Ticket | `PROJ-123` | Select the packet |
| Fresh workspace | `/work/review-001` | Hold input copies and generated output |
| Stage, owned by the adapter | `30-code-review` | Give this workflow its own run history |
| Actual tool version | `code-review@1.0.0` | Identify the producer in the run record |

Pin the published package in the adapter's environment; the delivered adapters use `0.1.1`.
A JavaScript consumer can import its
existing library API; another runtime can call the CLI and read its JSON results. Both use the
same store config and operations.

## 3. Connect the workflow's files

| Order | Adapter action | Input → output |
| --- | --- | --- |
| 1 | `fetch` | Ticket + store → packet directory + content digest |
| 2 | `begin` | Ticket + stage + digest + unique run key → reserved run and state file |
| 3 | Invoke the existing workflow | Packet directory → generated report/evidence directory |
| 4 | `checkpoint` | State file + generated directory → saved output and snapshot inventory |
| 5 | `locate` | Ticket + saved run/result paths → usable filesystem paths or Drive links |

Use the paths returned by each step. Choose the report from the workflow's actual output receipt.
Report success after saving and resolving its location succeeds. The LLM does not need storage
credentials; its input and output are files.

If the workflow only delivers an already rendered report, it can start at `begin`, save the
existing output directory, and return its location. A Jira producer instead prepares packet files
and calls `push`. These cases reuse the same package without pretending to run an LLM again.

## 4. Pass results to another stage

Each workflow owns a stage, for example `10-recon`, `20-ac-walkthrough`, or `30-code-review`.
For each new delivery, call `begin` again to reserve the next run, such as `v2`, leaving `v1`
available. Checkpoints within one delivery update that reserved run.

`fetch` retrieves the packet without run history. If a later workflow needs an earlier report,
also call `pull`, then pass the specifically selected stage/version to that workflow. Record the
selection in the consumer's input provenance; do not silently substitute the newest available run.

## 5. Prove the integration

Run the same adapter once with filesystem storage and once with Drive. Open the returned result,
compare it with the generated file, and repeat to verify preservation of the first run. Confirm
that a failed save returns failure even if report generation succeeded. If the workflow checkpoints
as it progresses, also run that sequence within one reserved version, including files it seals
read-only. Saving an existing report into two fresh versions does not exercise repeated checkpoints.

The storage integration does not change the workflow's verdicts or human approval rules. A
successfully stored draft remains a draft.

The [adapter contract](design/06-workflow-adapters.md) defines the implementation boundaries, and
the [CLI reference](design/03-architecture.md#cli-contract) gives exact storage-command arguments.

## Existing adapters to copy

| Consumer | Command from its repository | Input → saved output |
| --- | --- | --- |
| [Jira producer](https://github.com/doruksahin/jira-to-packet/blob/main/README.md) | `node bin/jira-to-packet.mjs --store /config/store.json --ticket PROJ-123 --workspace /work/jira-001` | Jira ticket → verified packet |
| AC-walkthrough | `node .github/scripts/run-walkthrough.mjs --store /config/store.json --ticket PROJ-123 --workspace /work/ac-001 --app /app/frontend` | Stored packet + running mock application → draft HTML and evidence |
| Recon delivery | `bash recon/scripts/store-dossier.sh --store /config/store.json --ticket PROJ-123 --source /work/recon/PROJ-123` | Current rendered workspace → dossier and supporting files |

The [operator playbook](playbook.md#run-the-same-flow-with-your-selected-store) puts these commands
in order. Run each command from its owning repository. Setup is documented in
[the Jira producer guide](https://github.com/doruksahin/jira-to-packet/blob/main/README.md),
[the portable walkthrough guide](https://github.com/AdCreative-ai/AC-visual-walkthrough/blob/main/docs/portable-workflows.md)
and [Recon storage](https://github.com/AdCreative-ai/recon-plugin/blob/master/recon/docs/storage.md).
AC also provides `run-walkthrough.mjs save --from <completed-workspace>` to save a validated existing
draft without another LLM run; the destination must already contain the matching packet.
