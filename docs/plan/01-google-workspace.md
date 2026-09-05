---
status: done
step: 01
title: CI access and shared configuration
---

# Step 01. CI access and shared configuration

## Outcome

A fresh GitHub Actions runner can read the nominated Jira ticket and read/write the configured
Shared Drive. The workflows obtain configuration and credentials independently of a user's vault.

## Owner, dependencies, and inputs

- Owner: an administrator with the required Google/GitHub access, with implementation in
  `doruksahin/AC-visual-walkthrough`.
- Depends on the completed storage core, steps 03–05. Publication is not required for this check.
- Inputs: the existing Drive/service-account details in step 05's evidence, repository access,
  and a Jira ticket suitable for the current lab walkthrough.

## Work

1. Inspect existing infrastructure and repository configuration. Reuse working resources. Record
   what already exists and configure only missing access.
2. Put one credential-free store config in the walkthrough repository at
   `.github/packet-store.json`. It selects the Shared Drive and the `packets` prefix. Both user
   workflows will use this file.
3. Confirm the CI secret `PACKET_STORE_DRIVE_SERVICE_ACCOUNT` and map it to
   `PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS` when invoking the package. Confirm exporter
   inputs `JIRA_HOST`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` through repository configuration/secrets.
   Confirm the existing walkthrough and application-checkout credentials remain available.
4. Run a recorded CI smoke check using the storage package built from an exact commit. Use an
   isolated scratch prefix on the same Drive for a small `push → fetch → begin → checkpoint → pull`
   round trip. Use the package's pinned rclone installer and credential mapping.
5. In CI, run the exporter against the nominated ticket into temporary storage. Validate its
   success receipt. Confirm that its AC material is suitable for the existing walkthrough mode.
6. Record how a later session runs this smoke check. Its script/workflow must be checked in or
   otherwise tied to the recorded commit. No developer shell profile supplies credentials.

## Done when

- The CI Drive round trip succeeds and the retrieved content matches what was written.
- The exporter succeeds on the nominated ticket from CI.
- Both workflows have a documented shared config and named credential sources.
- An authorized teammate has read access to the destination; CI access alone is insufficient.
- The evidence identifies the exact runner, commit, and smoke results. `doctor` alone does not
  prove access because it makes no network call.

## Evidence

Fresh runner proof passed on 2026-09-05 in [Actions run 33960198608](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33960198608)
([job 101290643868](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33960198608/job/101290643868), 1m20s).
The checked-in workflow and script are `.github/workflows/drive-ci-smoke.yml` and
`.github/scripts/drive-ci-smoke.sh`, at [PR 92](https://github.com/doruksahin/AC-visual-walkthrough/pull/92)
head `526209eb70a6acbd631d3954f9714040622afaa4`. Full repository tests, documentation links, and
Zot conformance passed in [CI run 33960198716](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33960198716).
PR 92 merged at `8c7367188286e9e4f8eaf730986ca1d76e2d22ac`.

- `.github/packet-store.json`: driver `gdrive`, Shared Drive `0APywiuwYbmGMUk9PVA`, prefix `packets`,
  identity `00 Packet.md`, `task.md`, `jira/**`.
- Existing service account: `task-packet-store-ci@adcreative-tooling.iam.gserviceaccount.com`.
- Confirmed secret names: `PACKET_STORE_DRIVE_SERVICE_ACCOUNT`, `TASK_PACKET_STORE_SOURCE_TOKEN`,
  `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`. Existing lab/application credentials include
  `CLAUDE_CODE_OAUTH_TOKEN` and `FRONTEND_REPO_TOKEN`. Values were never logged.
- Exact package source `bc2744a1596fc0a2d08577ddeb3167d63fbe1152`; exporter source
  `b9412c8114e0041cb8b755930d557d0ea8a454cd`, version `0.5.0`. Export receipt: `generic-v1`,
  `success`, one synced issue `ATT-5387`, nine numbered acceptance criteria.
- `push → fetch → begin → checkpoint → pull` passed; fetched bytes matched the source. The `v1`
  pull matched HTML and evidence bytes, run metadata, and checkpoint inventory across seven files.
- Packet SHA-256: `ea8ec406c41bda6eb644e392fedd4b0dcbc0298a16b1d106ed7c8b6d850d52b8`.
  Checkpoint inventory: `364937be42c61fa0cc89b2cbfc18352cd5e675cfc1a6267353d10cac7f7e6e74`.
- Scratch `ci-smoke/33960198608-1/TPS-33960198608` was removed after successful checks. The earlier
  local scratch `ci-smoke/1788602767-1` was also removed after the human-account read proof.
- The connected account `doruk.sahin@appier.com` read actual packet/run metadata and HTML bytes;
  the packet folder also opened in its authenticated browser. Step 05a records those observations.
  Existing inherited Shared Drive permissions were unchanged.

Repeat with a suitable real ticket:

```sh
gh workflow run drive-ci-smoke.yml --repo doruksahin/AC-visual-walkthrough \
  -f ticket=PROJ-123 -f retain_scratch=false
```

A retained scratch is available with `retain_scratch=true` when later inspection is needed.

## Handoff and rollback

Pass the config path, test ticket, and CI smoke invocation to steps 05a and 08. Retain existing
infrastructure if this step fails; revert only changes introduced by this step. Any scratch cleanup
is limited to its recorded scratch destination.
