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

Pin the published package in the adapter's environment. A JavaScript consumer can import its
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
Repeated saves reserve a new run such as `v2`, leaving `v1` available.

`fetch` retrieves the packet without run history. If a later workflow needs an earlier report,
also call `pull`, then pass the specifically selected stage/version to that workflow. Record the
selection in the consumer's input provenance; do not silently substitute the newest available run.

## 5. Prove the integration

Run the same adapter once with filesystem storage and once with Drive. Open the returned result,
compare it with the generated file, and repeat to verify preservation of the first run. Confirm
that a failed save returns failure even if report generation succeeded.

The storage integration does not change the workflow's verdicts or human approval rules. A
successfully stored draft remains a draft.

The [adapter contract](design/06-workflow-adapters.md) defines the implementation boundaries, and
the [CLI reference](design/03-architecture.md#cli-contract) gives exact storage-command arguments.
The [active plan](plan/README.md#active-delivery-reusable-workflow-storage) tracks the portable
walkthrough and Recon integrations; their verified operator commands will be linked here at delivery.
