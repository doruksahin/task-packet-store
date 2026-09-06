# Documentation and architecture maintenance

Start with the [architecture page](architecture/README.md) when a responsibility, interface,
dependency, storage/execution choice, or failure behavior changes. Follow its links to the
specific owner contract. The [shared documentation standard](https://github.com/doruksahin/plugin-architecture/blob/main/standard/README.md#progressive-disclosure-and-links)
defines the progressive reading path used across repositories.

## Check links

Use [lychee](https://github.com/lycheeverse/lychee#installation) 0.24.2 or newer locally. The
[architecture workflow](../.github/workflows/architecture.yml) installs its pinned version in CI.
From the repository root, run:

```sh
lychee --config .lychee.toml --offline './*.md' './docs/**/*.md' './.architecture/**/*.md'
```

This required check validates local file targets and heading fragments in the agent guides,
architecture references, operator docs, and checker provenance. It does not validate network
URLs. When changing cross-repository links, run the
[authenticated maintainer check](https://github.com/doruksahin/plugin-architecture/blob/main/docs/maintenance.md#check-links)
with this repository's input paths and read access to the linked private repositories.

## Verify the change

- Architecture or dependency changes: `python3 .architecture/check.py` validates the
  [repository contract](../.architecture/contract.json). The
  [shared audit](https://github.com/doruksahin/plugin-architecture/blob/main/docs/maintenance.md#adopt-a-new-repository)
  checks its relationship to the central model and shared checker.
- Every change: `pnpm check` runs the package's required checks from
  [package.json](../package.json).
- Release candidates: `pnpm release:check` adds the package artifact check.

Keep command/schema details in the [CLI contract](design/03-architecture.md); keep adapter
procedures in the [workflow integration guide](integrating-a-workflow.md). Agent entrypoints
and overview pages link to these owners instead of duplicating their full procedures.
