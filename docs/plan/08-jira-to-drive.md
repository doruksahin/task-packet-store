---
status: done
step: 08
title: Jira to packet on Drive
---

# Step 08. Jira → packet on Drive

## Outcome

The first command in [the operator contract](00-required-operator-flow.md) creates a complete
packet on Drive and returns its real folder link in the Actions summary.

## Owner, dependencies, and inputs

- Owner: `doruksahin/AC-visual-walkthrough`.
- Depends on step 01's CI configuration and step 06's release.
- Inputs: ticket, shared store config, pinned exporter/store versions, and a clean temporary
  workspace. The acceptance ticket has no existing packet in the destination.

## Deliverables

| Planned file | Responsibility |
| --- | --- |
| `.github/workflows/jira-to-packet.yml` | Ticket input, CI setup, export, preparation, upload, summary |
| `.github/scripts/prepare-task-packet.mjs` | Assemble consumer-ready packet files from explicit input paths |
| `.github/packet-template/` | Required root/stage templates and a compatible Jira output profile |
| Package manifest/lockfile and consumer docs/tests | Exact pins, input compatibility, user instructions |

## Work

1. Inspect the current walkthrough's packet input validation and the exporter's profile/receipt
   contract. Establish the minimum valid packet for the chosen mode and commit a representative
   fixture. This is the first implementation checkpoint: record the required files and their
   sources before writing the workflow.
2. Implement packet preparation using explicit paths and repository-owned templates. The exporter
   owns `jira/`; preparation supplies `00 Packet.md`, `task.md`, and required stage scaffolds.
   Preserve Jira's AC material and its approval context. No runtime template lookup uses a vault.
3. Verify that the prepared fixture can be stored and fetched through `fs` and accepted by the
   consumer's packet validation. File preparation itself needs neither Drive nor rclone.
4. Add the manually dispatched workflow with a required ticket input. Export Jira into the runner's
   temporary workspace using the pinned profile and validate the export receipt before preparation.
   Persist the prepared packet through `task-packet-store push`.
5. Record the producer packet digest, fetch the saved packet into a separate fresh directory, and
   compare digests. Resolve its real folder link through step 05a's interface. Only then write the
   `packet-ready` summary defined in the operator contract.
6. Run the consumer repository checks and a real CI invocation using the configured store. Record
   source commits, package/profile versions, the producer/fetched digest, and the packet link.

## Done when

- A suitable Jira ticket becomes a valid stored packet through the user's first command.
- The preparation and consumer-input check pass through `fs` without Drive credentials.
- The real CI run uploads to Drive, fetches the same packet identity, and returns a working link.
- The packet contains the required root files and Jira export, including relevant attachments.
- The workflow uses the shared config and pinned packages and has no vault checkout requirement.

## Evidence

- [PR 91](https://github.com/doruksahin/AC-visual-walkthrough/pull/91) merged at
  `aa4fc391ec15a8c2d5ad2813e1689e20c071d449`. Independent review cleared its exact head
  `7dc5b4284f47ff60ccc6a9c34005919f5bd0b701`; [CI 33962192596](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33962192596)
  passed the full test, documentation, and registry-conformance checks.
- Exact dependencies: `@doruksahin/task-packet-store@0.1.0` and Jira exporter `0.5.0`.
  The repository-owned `ac-walkthrough-packet-v1` profile is under
  `.github/packet-template/jira-profile/`; packet templates are under `.github/packet-template/packet/`.
  Profile digest: `sha256:b0478dff2dce263fd405979b809c17f3e64dde764b10b44340169483c0c0b781`.
- Eight focused tests passed, including the real filesystem push/fetch path, rejected incomplete
  attachment exports, preserved literal Jira title tokens, and a producer/fetch digest mismatch.
  Independent clean-checkout root, runtime, and legacy package installs passed with exact locks.
- The first dispatch was rejected before any runner or Drive write because job-level environment
  expressions cannot use `runner.temp`. [PR 95](https://github.com/doruksahin/AC-visual-walkthrough/pull/95)
  moves the three paths into an initial runner step and adds a regression check. It merged at
  `3b278eb2b3ee9570d9389ae9c2fe65ac7da2c131` after independent review, actionlint, and
  [full CI 33962529820](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33962529820).
- The exact user command with `-f ticket=ATT-5387` completed successfully in
  [Actions run 33962806577](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33962806577),
  using default-branch commit `08307480cce07cfcab32d94df1359d1055f5d9d5`.
  Producer and fetched SHA-256 both equal
  `2502dacdd4f4f70a13a4b8416d84cc70dd3e7bf5d398b223e9532558285f7653`;
  the saved comparison reports `match: true`, and the fetched packet has nine files.
- Jira receipt: one successful issue, six comments, two attachments, two downloaded attachments,
  no warnings. The consumer accepted the fetched packet with `acState: present`.
- The run summary reports `packet-ready` at `packets/ATT-5387/` and the actual
  [Drive packet folder](https://drive.google.com/drive/folders/1B4PV0MlE0O_JoWyNbksZoiPq2s8L-BiZ).
  The intended operator's connected Drive account listed its root and Jira files and read
  `00 Packet.md`, independently confirming access and the recorded exporter/profile provenance.
  Diagnostic artifact `jira-to-packet-ATT-5387` retains all seven producer receipts.

## Handoff and rollback

Pass the packet path/link, digest, and successful run URL to step 09. Revert the workflow or
preparation change if needed; preserve uploaded packets as evidence. Refreshing an existing packet
and reconciling manual edits are outside this first creation proof.
