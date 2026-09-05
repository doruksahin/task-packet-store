# Playbook: Jira → stored packet → walkthrough → stored report

Use the configured GitHub Actions Drive flow below, or jump to
[the portable commands](#run-the-same-flow-with-your-selected-store) to choose filesystem or Drive
storage on your own execution host. That section also shows Recon using the same config.

Run two workflows in order: create the packet, then run the walkthrough against that saved packet.
GitHub Actions does the processing in temporary workspaces; Google Shared Drive keeps the packet
and results. You can start either workflow from any computer with repository access, or from
GitHub's website.

```text
Jira ticket
    ↓  jira-to-packet.yml
Packet on Shared Drive
    ↓  pause here for other work, then run walkthrough-lab.yml
HTML report + evidence + run records on Shared Drive
```

This is the working Drive flow, verified on 2026-09-05. The current walkthrough runs against the
configured `v2-mock` application and produces a **draft report**. The ticket input selects the
packet; application branches and target URLs are not inputs to these commands.

## Before you start

- Have a Jira ticket with the acceptance criteria you want to examine. Replace `PROJ-123` below
  with that ticket. Start with a ticket that has no packet in the store yet.
- Have permission to run workflows in `doruksahin/AC-visual-walkthrough` and read the configured
  Shared Drive. For terminal commands, GitHub CLI (`gh`) must already be signed in.
- The repository's Drive destination, Jira credentials, and walkthrough/application credentials
  must be configured. This deployment is already set up; see [administrator setup](plan/01-google-workspace.md)
  when configuring another deployment.

The commands below can run from any directory. GitHub Actions installs the processing tools and
uses repository secrets; your computer only submits the request and opens the results.

## 1. Create the packet on Drive

**Input:** a Jira ticket key. The workflow reads its description, comments, and attachments, then
uses the repository's templates to prepare the packet.

```sh
gh workflow run jira-to-packet.yml \
  --repo doruksahin/AC-visual-walkthrough \
  -f ticket=PROJ-123
```

**Immediate output:** confirmation that GitHub accepted the request, with a run URL when available.
Processing continues on the runner. Open that run, or find it in
[Jira to Drive packet runs](https://github.com/doruksahin/AC-visual-walkthrough/actions/workflows/jira-to-packet.yml).
Wait for **success** before starting step 2.

**Completed output:** the run summary contains:

```text
Ticket: PROJ-123
Status: packet-ready
Packet: packets/PROJ-123/
Open packet: <actual Google Drive folder link>
```

Open the packet link. You should find:

| Saved file or folder | What it contains |
| --- | --- |
| `00 Packet.md` | Packet identity and source information |
| `task.md` | Task entry point |
| `jira/00 Issue.md` | Exported Jira description, including its AC material |
| `jira/10 Comments.md` | Jira comments, kept separate from the description |
| `jira/20 Attachments.md` and `jira/attachments/` | Attachment metadata and downloaded files |
| `jira/90 Sync.md` | Export metadata |
| `stages/20-ac-walkthrough/README.md` | Walkthrough stage scaffold |

The workflow uploads the packet, fetches it back, checks that the saved bytes match, and validates
it as walkthrough input before reporting `packet-ready`. You do not upload files manually.

## 2. Run the walkthrough using the saved packet

**Input:** the same ticket key and its existing Drive packet. You can run this immediately or
later. This step reads the saved packet; it does not refresh it from Jira.

```sh
gh workflow run walkthrough-lab.yml \
  --repo doruksahin/AC-visual-walkthrough \
  -f ticket=PROJ-123
```

**Immediate output:** another dispatch confirmation. Open its run, or find it in
[Walkthrough lab runs](https://github.com/doruksahin/AC-visual-walkthrough/actions/workflows/walkthrough-lab.yml),
and wait for **success**.

**Completed output:** for the first reserved run, the summary contains:

```text
Ticket: PROJ-123
Status: report-saved
Run: v1
Run folder: packets/PROJ-123/stages/20-ac-walkthrough/runs/v1/
Report: <actual HTML path inside this run's delivery/ folder>
Open report: <actual Google Drive file link>
Open run: <actual Google Drive folder link>
```

The runner fetches the packet, reserves a new run, starts the mock application, performs the
walkthrough, renders the HTML, and saves the report and evidence. `report-saved` is emitted after
the complete output has been uploaded and its Drive links resolved.

## 3. Open the result, then repeat when needed

- **Open report:** retrieve/download the HTML from Drive and open it in Chrome or another browser.
  Drive stores the HTML file; the link is not a hosted website. Screenshots are embedded in the HTML.
- **Open run:** inspect `delivery/` for the HTML, `input/` for capture material and evidence,
  `run.md` for run provenance, and `snapshot.json` for the latest saved-file inventory.
- **Read the verdicts:** `report-saved` confirms generation and storage. The draft report itself
  says which ACs passed, failed, or still need evidence.
- **Repeat:** run step 2 again with the same ticket. It reserves the next available `vN` and
  preserves earlier runs. Use the summary's actual report link; an HTML filename may still end in
  `v1` inside a store folder named `v2` because the runner numbers its own temporary output separately.

Files live under **Shared drives → the configured drive → packets → your ticket**. For this
deployment, use the [packets folder](https://drive.google.com/drive/folders/1JlWfAw3yRk3-l2mBObMqRb3vhTyYW8ks).
Open it with the Google account that has access to that Shared Drive. It is separate from My Drive.

The current report's trace shortcut can refer to a temporary runner path. Retrieve the saved trace
from the run folder at `input/capture/trace.zip` when you need it.

## Follow either run from the terminal

Use the run ID from its URL, such as the number after `/actions/runs/`. Replace `RUN_ID` below with
that number. Follow the exact run you started, rather than assuming the newest run belongs to you.

```sh
gh run watch RUN_ID --repo doruksahin/AC-visual-walkthrough --exit-status
gh run view RUN_ID --repo doruksahin/AC-visual-walkthrough --web
```

The first command waits and returns a nonzero exit status if the run fails. The second opens the
run page containing the result summary. You can also perform the whole flow on GitHub: open each
workflow page linked above, select **Run workflow** on `main`, enter the ticket, and run them in
the same order.

If a run fails, open its failed step and diagnostics. A reserved Drive folder can contain partial
checkpoints; use `report-saved` in a successful run summary to identify a completed delivery.
Refreshing a packet from changed Jira content is a separate follow-up: step 1 uploads packet
files and can replace existing source files, so it is not a review/merge workflow for manual edits.

## What happens between input and output

These are the steps the workflows execute for you. The commands here name the underlying tools;
the two `gh workflow run` commands above are the operator entry points.

| Order | Processing step | Input | Output |
| --- | --- | --- | --- |
| 1 | `jira-markdown-export` | Ticket + Jira access + export profile | Exported Jira files and receipt on the runner |
| 2 | `prepare-task-packet.mjs` | Exported files + receipt + packet templates | Complete packet directory on the runner |
| 3 | `task-packet-store push`, then `fetch` and `locate` | Prepared packet + store config | Verified packet on Drive + packet link |
| 4 | `task-packet-store fetch` | Ticket + existing Drive packet | Read-only packet copy and content digest on a fresh runner |
| 5 | `task-packet-store begin` | Ticket + stage + input digest | Reserved `runs/vN/`, `run.md`, and runner state file |
| 6 | AC-walkthrough, with `checkpoint` as it progresses | Fetched packet + configured application | Draft HTML and evidence; intermediate saves on Drive |
| 7 | Final `checkpoint`, then `locate` | Complete run output | Saved HTML, evidence, inventory, and actual Drive links |

You can pause after step 1 of the operator flow for other work. Additional processing stages need
their own invocation and stage folder; these two workflows currently automate packet creation and
the walkthrough. `push`/`fetch` handle packet files and exclude run history; `begin`/`checkpoint`
save stage runs. `pull` is available when a separate consumer needs a local copy of saved runs.

## Run the same flow with your selected store

The portable commands run on any prepared execution host. Select the store once and pass the same
absolute config path to each command. The host can be your computer, a server, or a CI runner.

| Choice | Durable home | Processing workspace | Entry point |
| --- | --- | --- | --- |
| Google Drive | Configured Shared Drive | Fresh working directory | Portable commands below, or the two configured Actions workflows above |
| Filesystem (`fs`) | A persistent directory accessible to the process | Separate fresh working directory | The same portable commands below |

For example, save one of these configurations as `/srv/config/task-store.json`:

```json
{"driver":"fs","root":"/srv/task-packets"}
```

```json
{"driver":"gdrive","sharedDriveId":"YOUR_SHARED_DRIVE_ID","prefix":"packets"}
```

Replace the example paths and Drive ID with your own. Filesystem storage needs no Google credentials
or rclone. Its directory must survive between runs: use a persistent host or mounted volume if you
want separate jobs to share it. A hosted runner's temporary disk lasts only for that job.

Prepare an `AC-visual-walkthrough` checkout using its
[portable runner setup](https://github.com/doruksahin/AC-visual-walkthrough/blob/main/docs/portable-workflows.md).
That page covers pinned dependencies, Jira access, walkthrough credentials, and the mock application.
Run the following commands from that checkout.

**1. Jira → packet in the selected store.** Input: ticket key, Jira credentials, config, and a fresh
workspace path.

```sh
node .github/scripts/jira-to-packet.mjs \
  --store /srv/config/task-store.json --ticket PROJ-123 \
  --workspace /srv/work/jira-PROJ-123-001
```

Output: one JSON result with `status: "packet-ready"`, `packetSha256`, and `packet.location`.
That location is the saved packet's filesystem path or Drive folder URL. The command verifies the
saved packet before reporting success. You can pause here for other work.

**2. Stored packet → walkthrough → stored draft.** Input: the same config and ticket, a fresh
workspace, and the prepared application checkout with its mock server running.

```sh
node .github/scripts/run-walkthrough.mjs \
  --store /srv/config/task-store.json --ticket PROJ-123 \
  --workspace /srv/work/walkthrough-PROJ-123-001 --app /srv/app/frontend
```

Output: one JSON result with `status: "report-saved"`, `label: "draft"`, `version`,
`report.location`, and `run.location`. Open the report path or download the HTML from its Drive
URL. The run location contains supporting evidence and records under
`PROJ-123/stages/20-ac-walkthrough/runs/vN/`. Repeat with a new workspace to create the next version.

**3. Save another plugin's output using that same config.** For Recon, first produce its normal
current ticket workspace and rendered dossier. From the `recon-plugin` checkout:

```sh
bash recon/scripts/store-dossier.sh \
  --store /srv/config/task-store.json --ticket PROJ-123 \
  --source /srv/recon/PROJ-123
```

Input: the existing current ticket workspace, including `report/dossier.html` and supporting files.
Output: one JSON receipt with `version` and `locations.primary.location` for the saved dossier,
plus run, run-record, and snapshot locations under `PROJ-123/stages/10-recon/runs/vN/`.
This delivery command saves the existing dossier. Recon's rendering and approval steps keep their
usual behavior. See [Recon storage setup](https://github.com/AdCreative-ai/recon-plugin/blob/master/recon/docs/storage.md).

To connect a third workflow, follow the [integration guide](integrating-a-workflow.md). The workflow
reads and writes ordinary directories; its adapter uses the selected store before and after that work.

## References

- [Live acceptance record](plan/10-drive-acceptance.md): successful runs, saved reports, and verified
  preservation of the first run after the second.
- [Operator contract](plan/00-required-operator-flow.md): required behavior for these workflows.
- [Plan board](plan/README.md): completed delivery and remaining integrations.
