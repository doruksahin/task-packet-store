---
status: in-progress
step: 06
title: Publish the consumer release
---

# Step 06. Publish the consumer release

## Outcome

A fresh runner can install one exact published version containing the storage operations and the
result-location support required by both user workflows.

## Owner, dependencies, and inputs

- Owner: `task-packet-store`, with an npm/repository maintainer for publishing setup.
- Depends on steps 01 and 05a. Step 05 already records the core's real-Drive round trip.
- Inputs: the completed source commits, working release workflow, and npm publishing access.

## Work

1. Inspect the existing repository, release state, and npm package before provisioning anything.
   Complete only missing release configuration, following this repository's release workflow and
   the exporter's release precedent.
2. Prepare the release that includes step 05a. The original target is `0.1.0`; if that version is
   already published, select the next appropriate release and record it. Never replace a published
   version. Use the existing Release Please and trusted-publishing process.
3. Run `pnpm release:check` against the exact release candidate. Preserve the generated release
   artifact and checksum verification required by the repository's release process.
4. Publish through that process. From a clean CI runner, install the exact published package and
   exercise the documented commands, including result locations, against a local fixture.
5. Record the exact exporter version the consumer will pin as well. Step 08 validates its selected
   output profile; publishing a new exporter is not required unless that validation finds a gap.

## Done when

- npm serves the recorded exact package version with the expected source and location interface.
- The GitHub Release contains the package artifact and checksums.
- `pnpm release:check` and the clean-runner installed-package check pass.
- The evidence supplies exact package versions for the walkthrough lockfile and CI install.

## Evidence

Pending. Record:

- Release PR, source commit, exact version, and release URL.
- `pnpm release:check` result and artifact checksum.
- Clean-install Actions run URL and command results.
- Selected exporter version.

## Handoff and rollback

Steps 08 and 09 use the same recorded package version, never `latest`. If a published release is
faulty, deprecate it and publish a corrected version; do not unpublish a version consumers pinned.
