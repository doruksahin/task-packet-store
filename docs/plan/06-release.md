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

The GitHub artifact is ready; npm publication is awaiting the first owner sign-in.

- [Release PR 3](https://github.com/doruksahin/task-packet-store/pull/3) merged at
  `793b2ec1450d37ef354ec5807e5c948a35238546`; [GitHub Release v0.1.0](https://github.com/doruksahin/task-packet-store/releases/tag/v0.1.0)
  contains `doruksahin-task-packet-store-0.1.0.tgz` and `SHA256SUMS`.
- [Release run 33960550447](https://github.com/doruksahin/task-packet-store/actions/runs/33960550447)
  passed `pnpm release:check` (190 tests), deterministic artifact creation/checksum verification,
  and the isolated installed-package smoke before uploading the assets. The smoke exercises
  local push/fetch/begin/checkpoint/pull, packet/run/HTML lookup, and dependency-free identity imports.
- Archive SHA-256: `02bea7886c5d78eb46453ed0ab7a63891d478d28ca825300248477e204855ee0`.
  The orchestrator downloaded this exact GitHub archive, verified `SHA256SUMS`, and independently
  passed the installed-package smoke. No replacement local build will be published.
- The final npm step returned `ENEEDAUTH`; the package does not yet exist on public npm. An
  interactive npm login is pending with the owner. Credentials are confined to a temporary npm
  user configuration and will be revoked/removed after bootstrap. No npm token is added to CI.
- After bootstrap, configure npm Trusted Publisher: GitHub owner `doruksahin`, repository
  `task-packet-store`, workflow `release-please.yml`, no environment, allow `npm publish`.
  Dispatch the existing tag with `publish_tag=v0.1.0` to verify GitHub/npm byte identity.
  That retry verifies an existing publication; it does not prove future OIDC authentication.
- Consumer versions: task packet store `0.1.0` once npm verification passes; Jira exporter `0.5.0`.

Completion still requires npm version/integrity verification, exact registry archive comparison,
the clean runner installed-registry-package check, and consumer lockfile pins.

## Handoff and rollback

Steps 08 and 09 use the same recorded package version, never `latest`. If a published release is
faulty, deprecate it and publish a corrected version; do not unpublish a version consumers pinned.
