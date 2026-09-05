---
status: pending
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

Pending. Record:

- Smoke script/workflow path, commit, and Actions run URL.
- Config path, Shared Drive ID, prefix, and service-account identity.
- Secret/configuration names confirmed, without values.
- Test ticket and exporter receipt outcome.
- Store command outcomes and content/digest comparison.
- Scratch destination and whether it was retained or removed.

## Handoff and rollback

Pass the config path, test ticket, and CI smoke invocation to steps 05a and 08. Retain existing
infrastructure if this step fails; revert only changes introduced by this step. Any scratch cleanup
is limited to its recorded scratch destination.
