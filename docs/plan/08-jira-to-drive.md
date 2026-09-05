---
status: pending
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

Pending. Record:

- PR/commit and packet fixture/profile paths.
- Consumer compatibility and local-store check commands/results.
- User command, exact Actions run URL, ticket, and package/profile versions.
- Producer and fetched digests, saved folder path, and actual Drive link.

## Handoff and rollback

Pass the packet path/link, digest, and successful run URL to step 09. Revert the workflow or
preparation change if needed; preserve uploaded packets as evidence. Refreshing an existing packet
and reconciling manual edits are outside this first creation proof.
