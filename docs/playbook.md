# Playbook: Jira → stored packet → walkthrough → stored report

Run the Jira producer first, then give AC-walkthrough the saved packet. Both commands receive
the same store configuration. Choose filesystem or Google Drive storage independently of the
computer or CI runner that processes the files.

```text
Jira → jira-to-packet → saved packet
                           ↓ pause for other work
                      AC-walkthrough → saved draft HTML + evidence
```

## Before you start

Prepare the separate [Jira producer checkout](https://github.com/doruksahin/jira-to-packet/blob/main/README.md)
and [AC-walkthrough checkout](https://github.com/doruksahin/AC-visual-walkthrough/blob/main/docs/portable-workflows.md).
Their owner guides cover dependency installation and credentials. AC also needs a prepared
application checkout with the supported `v2-mock` server running at `http://localhost:5173/`.
These commands do not select an arbitrary application branch or preview URL.

Set these example paths to your own installed checkouts and configuration. No particular folder
layout or published producer package is required:

```sh
PRODUCER_CHECKOUT=/srv/tools/jira-to-packet
AC_CHECKOUT=/srv/tools/AC-visual-walkthrough
APP_CHECKOUT=/srv/app/frontend
STORE_CONFIG=/srv/config/task-store.json
```

## Run the same flow with your selected store

Save one of these credential-free configurations at `STORE_CONFIG`:

```json
{"driver":"fs","root":"/srv/task-packets"}
```

```json
{"driver":"gdrive","sharedDriveId":"YOUR_SHARED_DRIVE_ID","prefix":"packets"}
```

Replace the example directory or Drive ID. Filesystem storage needs a directory that survives
between runs; separate CI jobs need a shared durable mount. Drive requires pinned rclone and one
of the [credential environment variables](design/03-architecture.md#credentials) on the execution
host. Credentials stay outside the JSON file. All processing workspace paths below must be fresh.

### 1. Create and save the packet

**Input:** a Jira ticket, Jira credentials, store configuration, and a fresh processing workspace.
Run from any directory:

```sh
node "$PRODUCER_CHECKOUT/bin/jira-to-packet.mjs" \
  --store "$STORE_CONFIG" --ticket PROJ-123 \
  --workspace /srv/work/jira-PROJ-123-001
```

**Output:** one JSON result with `status: "packet-ready"`, `packetSha256`, and `packet.location`.
The location is the saved filesystem directory or Drive folder URL. It contains the packet entry
files, exported `jira/` source, and stage scaffolds. The producer exports, prepares, pushes, fetches
back, and verifies the packet before reporting success. You can pause here for other work.

### 2. Consume the packet and save the walkthrough

**Input:** the same ticket and store configuration, a fresh workspace, and the prepared running
application. This step reads the existing packet; it does not create or refresh it from Jira.

```sh
node "$AC_CHECKOUT/.github/scripts/run-walkthrough.mjs" \
  --store "$STORE_CONFIG" --ticket PROJ-123 \
  --workspace /srv/work/walkthrough-PROJ-123-001 --app "$APP_CHECKOUT"
```

**Output:** one JSON result with `status: "report-saved"`, `label: "draft"`, `version`,
`report.location`, and `run.location`. Missing or invalid packets stop before LLM execution or
output reservation. The complete report must be saved before success is reported.

### 3. Open the result or repeat

Open the returned filesystem report, or download its HTML from the Drive link and open it in a
browser. Drive keeps the HTML file; it does not host the report as a website. The run location
contains evidence, `run.md`, and `snapshot.json` under the ticket's
`stages/20-ac-walkthrough/runs/vN/` directory.

Repeat step 2 with a fresh workspace to create the next run. Earlier runs remain available.
`report-saved` confirms generation and storage; the draft report describes the AC verdicts and
still follows the workflow's human review rules.

## Run through GitHub Actions

The producer workflow belongs to [jira-to-packet](https://github.com/doruksahin/jira-to-packet/blob/main/.github/workflows/jira-to-packet.yml);
the consumer workflow belongs to [AC-walkthrough](https://github.com/doruksahin/AC-visual-walkthrough/blob/main/.github/workflows/walkthrough-lab.yml).
Before dispatch, configure the producer repository's store variable and secrets according to its
[setup guide](https://github.com/doruksahin/jira-to-packet/blob/main/README.md), and give both jobs
access to the same persistent store. Deployment activation in the new producer repository is not
yet verified by this documentation change.

```sh
gh workflow run jira-to-packet.yml --repo doruksahin/jira-to-packet -f ticket=PROJ-123
```

Open the dispatched run and wait for `packet-ready` with its saved packet location. Then run:

```sh
gh workflow run walkthrough-lab.yml --repo doruksahin/AC-visual-walkthrough -f ticket=PROJ-123
```

Wait for `report-saved` and open its actual report/run links. Follow each exact run ID with
`gh run watch RUN_ID --repo OWNER/REPOSITORY --exit-status`, using the repository that owns that
run. Your computer submits the request; the runner executes the workflow.

## Add another workflow

Recon can save an already rendered dossier using the same configuration:

```sh
bash "$RECON_CHECKOUT/recon/scripts/store-dossier.sh" \
  --store "$STORE_CONFIG" --ticket PROJ-123 --source /srv/recon/PROJ-123
```

Set `RECON_CHECKOUT` to its installed checkout. Input is the current ticket workspace containing
`report/dossier.html`; output is a JSON receipt including `locations.primary.location` and a saved
`10-recon` run. Follow [Recon's storage guide](https://github.com/AdCreative-ai/recon-plugin/blob/master/recon/docs/storage.md)
for setup. The [integration guide](integrating-a-workflow.md) describes another plugin's adapter.

## Verification history

The [2026-09-05 Drive acceptance](plan/10-drive-acceptance.md) and
[reusable storage acceptance](plan/15-reusable-storage-acceptance.md) preserve the original verified
runs, versions, result links, and limitations. Their AC-owned producer commands describe that
historical deployment. Current repository ownership and extraction verification are maintained
in the [shared architecture plan](https://github.com/doruksahin/plugin-architecture/blob/main/PLAN.md).
