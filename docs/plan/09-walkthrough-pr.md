---
status: pending
step: 09
title: Walkthrough PR
---

# Step 09. Walkthrough PR

## Goal

`walkthrough-lab.yml` fetches the packet from the Shared Drive, reserves a run, checkpoints after
every phase, and needs no R2 and no Git artifacts repository. The plugin runtime does not change.

## Depends on

Steps 06 and 08.

## Files in `/Users/doruk/Desktop/ADCREATIVE/llm/llm-workflows/AC-visual-walkthrough`

| File | Change |
| --- | --- |
| `.github/workflows/walkthrough-lab.yml` | Steps below |
| `.github/walkthrough-agent-prompt.md` | `storage: git` becomes `storage: local` |
| `package.json` | Add devDependency `@doruksahin/task-packet-store` at exact `0.1.0` |
| `packages/ac-walkthrough-plugin/runtime/scripts/src/run-history.ts` | `packetSha256(root)` delegates to the package with `DEFAULT_IDENTITY` |
| `test/packet-digest-contract.test.mjs` | Import `packetSha256` from the package instead of `packages/packet-store` |
| `docs/adr/ADR-0016-store-packets-and-runs-on-google-drive.md` | New. Supersedes ADR-0015 ingress and the Git persistence for CI |
| `docs/adr/ADR-0015-...md` | Status row: superseded by ADR-0016 |
| `README.md` | Row for `packages/packet-store/` points to the new package. GitHub Actions section describes the Drive flow |

## Workflow changes

Replace the step "Write packet-store configuration" with:

```yaml
      - name: Install rclone and task-packet-store
        run: |
          version=v1.75.0
          mkdir -p "$RUNNER_TEMP/bin"
          curl -fsSLO "https://downloads.rclone.org/$version/rclone-$version-linux-amd64.zip"
          curl -fsSLO "https://downloads.rclone.org/$version/SHA256SUMS"
          grep "rclone-$version-linux-amd64.zip" SHA256SUMS | sha256sum --check
          unzip -q "rclone-$version-linux-amd64.zip"
          install -m 0755 "rclone-$version-linux-amd64/rclone" "$RUNNER_TEMP/bin/rclone"
          npm install --global --prefix "$RUNNER_TEMP/tps" @doruksahin/task-packet-store@0.1.0
          echo "$RUNNER_TEMP/bin" >> "$GITHUB_PATH"
          echo "$RUNNER_TEMP/tps/bin" >> "$GITHUB_PATH"

      - name: Write the packet-store configuration
        run: |
          cat > "$RUNNER_TEMP/packet-store.json" <<'JSON'
          { "driver": "gdrive", "sharedDriveId": "<from step 01>", "prefix": "packets" }
          JSON
```

Replace "Fetch packet from R2" with:

```yaml
      - name: Fetch the packet from the Shared Drive
        env:
          PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS: ${{ secrets.PACKET_STORE_DRIVE_SERVICE_ACCOUNT }}
        run: |
          mkdir -p "$RUNNER_TEMP/packets"
          task-packet-store fetch \
            --store "$RUNNER_TEMP/packet-store.json" \
            --ticket "$TICKET" \
            --destination "$RUNNER_TEMP/packets" | tee "$RUNNER_TEMP/fetch-output.json"

      - name: Reserve the stage run
        env:
          PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS: ${{ secrets.PACKET_STORE_DRIVE_SERVICE_ACCOUNT }}
        run: |
          task-packet-store begin \
            --store "$RUNNER_TEMP/packet-store.json" \
            --ticket "$TICKET" \
            --stage 20-ac-walkthrough \
            --run-key "gha-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" \
            --tool "ac-walkthrough@$(cat version.txt)" \
            --packet-sha256 "$(jq -r .packetSha256 "$RUNNER_TEMP/fetch-output.json")" \
            --state "$RUNNER_TEMP/run-state.json" | tee "$RUNNER_TEMP/begin-output.json"
```

In the step "Phases 1–4 — Run the verification skill":

- Add `PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS: ${{ secrets.PACKET_STORE_DRIVE_SERVICE_ACCOUNT }}`
  to its `env`. Remove `GH_TOKEN`.
- Add this function before `observe_phases`:

  ```bash
  checkpoint_run() {
    local version_dir
    version_dir=$(jq -er '.versionDirectory' "$RUNNER_TEMP/init-output.json" 2> /dev/null) || return 0
    task-packet-store checkpoint \
      --state "$RUNNER_TEMP/run-state.json" \
      --reason "$1" \
      --source "$version_dir" >> "$RUNNER_TEMP/checkpoints.jsonl" \
      || echo "::warning title=Checkpoint failed::reason=$1"
  }
  ```

  Confirm the key name of the version directory in the initialize output. `RunHandle` names it
  `versionDirectory`. Adjust the `jq` path if the output uses another name.

- In every `case "$reason"` branch of `observe_phases`, add `checkpoint_run "$reason"` as the first
  line.

Add a final step after "Phases 1–4":

```yaml
      - name: Checkpoint the finished run
        if: always()
        env:
          PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS: ${{ secrets.PACKET_STORE_DRIVE_SERVICE_ACCOUNT }}
        run: |
          if [[ ! -s "$RUNNER_TEMP/run-state.json" ]]; then exit 0; fi
          version_dir=$(jq -er '.versionDirectory' "$RUNNER_TEMP/init-output.json" 2> /dev/null) || exit 0
          task-packet-store checkpoint --state "$RUNNER_TEMP/run-state.json" --reason finished --source "$version_dir"
          {
            echo "## Packet store"
            echo
            echo "Run: $(jq -r .runDirectory "$RUNNER_TEMP/begin-output.json") on the Shared Drive under packets/$TICKET"
          } >> "$GITHUB_STEP_SUMMARY"
```

Add `${{ runner.temp }}/begin-output.json`, `run-state.json`, and `checkpoints.jsonl` to the
diagnostics upload.

## Digest scoping in the plugin

In `run-history.ts`, replace the body of `packetSha256`:

```ts
import { DEFAULT_IDENTITY, packetSha256 as identityPacketSha256 } from '@doruksahin/task-packet-store';

export function packetSha256(root: string): string {
  return identityPacketSha256(root, DEFAULT_IDENTITY);
}
```

The runtime bundler includes the dependency, so the installed plugin still ships no `node_modules`.
Run `pnpm package:runtime` and commit the rebuilt runtime as the repository requires.

In `test/packet-digest-contract.test.mjs`, replace the import of `packages/packet-store/src/` with
the package. Keep the assertion that the plugin digest equals the package digest for a fixture that
contains `stages/*/runs/**`.

## Steps

1. Branch `feat/packet-store-drive`.
2. Apply the file changes.
3. `pnpm test`. Expected: green, including the contract test.
4. Push. Open a PR titled `feat: fetch packets and persist runs through task-packet-store`.
5. After CI passes, run the workflow by hand: `gh workflow run walkthrough-lab.yml -f ticket=ATT-5387`.
6. Merge after the run is green.

## Done when

```bash
gh run list --workflow walkthrough-lab.yml --limit 1 --json conclusion --jq '.[0].conclusion'
rclone lsjson -R ":drive,team_drive=<id>:packets/ATT-5387/stages/20-ac-walkthrough/runs" | jq -r '.[].Path'
```

Expected: `success`, and a listing that contains `v1/run.md`, `v1/snapshot.json`, and files under
`v1/delivery/` and `v1/input/`.

## Evidence

```text
```

## Rollback

Revert the PR. The R2 path and `packages/packet-store` still exist until step 12.
