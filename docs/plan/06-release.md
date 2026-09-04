---
status: pending
step: 06
title: Release 0.1.0
---

# Step 06. Release 0.1.0

## Goal

`@doruksahin/task-packet-store@0.1.0` is on npm. A checksummed tarball is on the GitHub Release.

## Depends on

Step 05.

## Steps

1. Create the GitHub repository `doruksahin/task-packet-store`, private or public as you prefer for
   the exporter. Push `main`.

   ```bash
   cd /Users/doruk/Desktop/PROJECTS/tools/task-packet-store
   gh repo create doruksahin/task-packet-store --source . --push --private
   ```

2. Add the repository secret `RELEASE_PLEASE_TOKEN`. Use the same kind of fine-grained token as the
   exporter: Contents, Issues, Pull requests read/write, limited to this repository.

   ```bash
   gh secret set RELEASE_PLEASE_TOKEN --repo doruksahin/task-packet-store
   ```

3. Configure npm trusted publishing for the new package name. Follow
   `jira-markdown-exporter/docs/releasing.md`, section "npm bootstrap". This is a one-time action on
   npmjs.com that needs Doruk's npm account.

4. Merge the feature commits from steps 03 to 05 to `main` through a PR with a Conventional Commit
   title. Release Please opens `chore(main): release 0.1.0`.

5. Run the release gate on the release PR branch:

   ```bash
   pnpm release:check
   ```

6. Merge the release PR. The release workflow builds the tarball, verifies it, attaches it to the
   GitHub Release, and publishes it to npm.

## Done when

```bash
npm view @doruksahin/task-packet-store@0.1.0 version
npm exec --yes --package=@doruksahin/task-packet-store@0.1.0 -- task-packet-store --help
gh release view v0.1.0 --repo doruksahin/task-packet-store --json assets --jq '.assets[].name'
```

Expected: `0.1.0`, the help text, and asset names that include the tarball and `SHA256SUMS`.

## Evidence

```text
```

## Rollback

Deprecate the npm version with `npm deprecate`. Never unpublish a version that a consumer pinned.
