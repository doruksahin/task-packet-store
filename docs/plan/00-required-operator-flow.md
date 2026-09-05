# Required operator flow: Jira → Drive packet → Drive report

Status: implemented and verified on 2026-09-05. Both commands passed, and repeating the walkthrough
created `v2` with every stored `v1` file unchanged. This document remains the behavior contract;
[the acceptance record](10-drive-acceptance.md) contains observed results and disclosed limitations.

The user must be able to create a task packet from Jira, leave it on Google Drive, and later run
AC-walkthrough against that stored packet. Both operations run in GitHub Actions. They must work
without Doruk's machine, a vault checkout, Obsidian, or a personal Drive token on the user's machine.

## Starting conditions

- An administrator has configured the repository's Shared Drive destination and service-account
  secret, Jira exporter credentials, and existing walkthrough credentials and application target.
- The required package versions are available to the workflows. Store configuration is available
  in CI independently of the vault.
- The user has permission to run the workflows and read the resulting Drive files.
- For the first acceptance run, `PROJ-123` represents a Jira ticket containing the AC material
  required by the walkthrough, and `packets/PROJ-123/` does not exist on Drive yet.

## 1. User creates the packet on Drive

The user runs:

```bash
gh workflow run jira-to-packet.yml \
  --repo doruksahin/AC-visual-walkthrough \
  -f ticket=PROJ-123
```

The command confirms dispatch; it does not wait for the packet to be ready. The user opens the
resulting run in GitHub Actions. On successful completion, its summary must show:

```text
Ticket: PROJ-123
Status: packet-ready
Packet: packets/PROJ-123/
Open packet: <actual Google Drive folder link>
```

The workflow must export Jira, create the packet files required by AC-walkthrough, and save the
complete packet with `task-packet-store push`. The preparation script owns packet assembly; the
Jira exporter continues to own its exported Jira directory. Required templates must be available
to the runner without reading a user's vault.

At completion, the linked Drive folder must contain `00 Packet.md`, `task.md`, and the exported
`jira/` content, plus any stage scaffolds required by the consumer. The summary must be emitted
only after the packet has been saved successfully. No manual upload is part of this operation.

## 2. User runs AC-walkthrough against the packet on Drive

After the first operation succeeds, the user may run this command from the same or another
computer, immediately or later:

```bash
gh workflow run walkthrough-lab.yml \
  --repo doruksahin/AC-visual-walkthrough \
  -f ticket=PROJ-123
```

The command confirms dispatch. On successful completion, the Actions run summary must show the
actual generated paths and links. For the first run, the required result is:

```text
Ticket: PROJ-123
Status: report-saved
Run: v1
Run folder: packets/PROJ-123/stages/20-ac-walkthrough/runs/v1/
Report: <actual HTML file path inside that run's delivery/ directory>
Open report: <actual Google Drive HTML file link>
Open run: <actual Google Drive run-folder link>
```

The workflow must fetch the existing packet from Drive with `task-packet-store fetch`, run
AC-walkthrough in the runner's temporary workspace, and save the generated HTML and accompanying
evidence with `begin` and `checkpoint`. It must not re-export Jira as part of this operation.

The HTML, evidence, `run.md`, and `snapshot.json` must be on Drive before the workflow reports
`report-saved`. The user must be able to follow the report link to retrieve and open the HTML.
Temporary runner paths alone do not satisfy the output requirement. A later walkthrough run must
use the next version and leave earlier runs available.

This first storage proof keeps the existing lab's configured application target and draft-report
behavior. `report-saved` means the report was generated and stored; its AC verdicts remain in the
report.

## Acceptance requirement

Starting with no packet for the chosen ticket on Drive:

1. Run the first command and verify the packet through its Drive link.
2. Run the second command on a fresh runner that has access to that store. Its recorded input
   digest must match the packet created by the first operation.
3. Retrieve the resulting HTML from Drive and verify that it opens and contains the walkthrough
   results. Verify that the run's evidence and records are present too.
4. Run the walkthrough again, verify that it produces `v2`, and confirm that `v1` is unchanged.

All four must succeed without a vault checkout, local upload, local pull, or Obsidian step.
The same workflows must also be runnable from GitHub's Actions UI with the same ticket input.

## Implementation steps

| Required work | Plan location |
| --- | --- |
| Configure and verify CI access and shared configuration | [01](01-google-workspace.md) |
| Implement result locations and actual Drive links | [05a](05a-result-locations.md) |
| Publish the package version required by both workflows | [06](06-release.md) |
| Add `jira-to-packet.yml`, packet preparation, and its result summary | [08](08-jira-to-drive.md) |
| Integrate the walkthrough with Drive and its result summary | [09](09-walkthrough-pr.md) |
| Prove both commands, retrieved HTML, and preserved v1/v2 runs | [10](10-drive-acceptance.md) |

Local OAuth setup and vault integration (steps 02 and 07) are optional conveniences. They must not
be prerequisites for this flow. The [plan board](README.md) defines the required order, current
statuses, and evidence protocol.

The existing packet-store transfer contracts and its `fs`/`gdrive` transports remain in place.
Step 05a specifies and implements the additional result-location interface before release. Storage
selection belongs in configuration, and workflow preparation must remain runnable against files
without assuming Drive or a vault. These operator commands specify the Drive delivery path; a
local-only invocation can be specified separately using the same file-processing steps.
