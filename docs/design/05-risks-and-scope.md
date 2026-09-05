# Risks, scope, and follow-ups

## Required first delivery

The [operator contract](../plan/00-required-operator-flow.md) defines the two commands and their
outputs. The [plan board](../plan/README.md) owns sequencing.

- Confirm existing Jira/Drive access from CI and provide one shared store configuration.
- Add read-only result-location support for both transports, then publish the consumer release.
- Export Jira and assemble a valid packet on a runner using consumer-owned templates.
- Store that packet on Drive, then fetch it in an independent walkthrough run.
- Save the lab's draft HTML, evidence, and run records on Drive and report actual links.
- Verify both commands from an empty ticket destination and preserve v1 when creating v2.

Package operations and packet preparation remain usable with filesystem storage. The local
invocation experience can be specified separately; the first acceptance run uses Drive.

## Risks accepted for the PoC

| Risk | Effect | Mitigation in this delivery |
| --- | --- | --- |
| Concurrent runs choose the same vN | Conflicting writers can overwrite output | Sequential acceptance runs; existing run-key conflict detection. Atomic reservation remains outside this proof |
| Drive listing lag | A run listing can be stale | Existing conflict checks; record the exact run and destination in evidence |
| Missing CI access | Export or storage cannot proceed | Step 01 verifies actual Jira reads and a Drive round trip |
| rclone version drift | Transport behavior changes | Pinned installation and recorded tested version |
| Report upload fails after rendering | HTML exists only on the runner | Final persistence and link resolution must succeed before report-saved |
| Prepared packet differs from consumer expectations | Walkthrough cannot consume exported Jira | Step 08 validates a representative packet through the actual consumer input contract |

The earlier real-Drive round trip is recorded in step 05. It proves the core operations, not the
new workflows, result links, or present CI configuration.

## Outside this delivery

- Packet assembly inside the Jira exporter or storage package. A consumer preparation script owns it.
- Refresh/merge policy for a packet already edited by humans.
- Local OAuth setup, Obsidian viewing, and a Work OS pull button.
- Vault mirror automation and blueprint schema changes.
- A new walkthrough target, production implementation provenance, or changes to report approval.
- Jira publishing changes and migration/deletion of historical external artifacts.
- Atomic multi-writer reservations, company OAuth client setup, and `seal`.

## Follow-ups

Optional local Drive access and vault integration are steps 02 and 07. Recon's step 11 is now part
of the [reusable-storage delivery](../plan/README.md#reusable-workflow-storage).
Retiring unused walkthrough storage code is step 12 and depends on the completed Drive acceptance proof.
A vault mirror, blueprint extension, or sealed-run feature needs its own subsequent scope.

Live acceptance identified two additional follow-ups in the consumer. The HTML's trace shortcut
still follows the existing renderer contract and points at the runner's absolute file path; the
saved trace is accessible through the reported Drive run folder at `input/capture/trace.zip`.
A portable shortcut needs a renderer/contract change or a resolved trace link in the Actions
summary. Checkpoint uploads can retain ephemeral capture-profile files from earlier checkpoints
because copies never delete stored files. A snapshot inventories the source at that checkpoint;
hidden paths are not generally excluded. The acceptance comparison freezes all stored bytes;
future cleanup can narrow new uploads while preserving historical runs.
