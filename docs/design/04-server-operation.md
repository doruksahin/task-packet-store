# Server operation

The runner uses rclone as the Drive client. There is no workaround. The differences from a laptop are
how the binary arrives and how it authenticates.

## 1. The binary arrives as a pinned download

```bash
version=v1.75.0
cd "$RUNNER_TEMP"
mkdir -p "$RUNNER_TEMP/bin"
curl -fsSLO "https://downloads.rclone.org/$version/rclone-$version-linux-amd64.zip"
curl -fsSLO "https://downloads.rclone.org/$version/SHA256SUMS"
grep "rclone-$version-linux-amd64.zip" SHA256SUMS | sha256sum --check
unzip -q "rclone-$version-linux-amd64.zip"
install -m 0755 "rclone-$version-linux-amd64/rclone" "$RUNNER_TEMP/bin/rclone"
echo "$RUNNER_TEMP/bin" >> "$GITHUB_PATH"
"$RUNNER_TEMP/bin/rclone" version
```

Both workflows, CI and the publish job of Release Please, run this through the composite action
`.github/actions/install-rclone`, whose `version` input defaults to the pinned tag.

## 2. Authentication is a service account, passed inline

```yaml
env:
  PACKET_STORE_DRIVE_SERVICE_ACCOUNT_CREDENTIALS: ${{ secrets.PACKET_STORE_DRIVE_SERVICE_ACCOUNT }}
```

The service account must be a member of the Shared Drive with the Content manager role. Use a
Shared Drive, not a My Drive folder. A service account has no My Drive quota and uploads fail.

A fetch-only job can set `RCLONE_DRIVE_SCOPE=drive.readonly` after the package's own mapping. The
PoC does not need it because the walkthrough runner both fetches and checkpoints.

## 3. The package runs one rclone command per operation

What `task-packet-store fetch` does around rclone:

```text
validate the config (zod)
spawn: rclone copy ":drive,team_drive=<id>:packets/PROJ-123" <temp dir> --checksum --exclude "/stages/*/runs/**"
reject any path that is not a safe relative path of regular files
chmod 0444 on every file
rename <temp dir> to <destination>/PROJ-123, refuse when it exists
compute packetSha256 over the identity globs
print one JSON object
```

What `task-packet-store checkpoint` does:

```text
read the state file
spawn: rclone lsjson --files-only <remote>/runs/v1      confirm run.md exists
spawn: rclone cat <remote>/runs/v1/run.md               compare run_key
spawn: rclone copy <source> <remote>/runs/v1 --checksum --exclude /run.md --exclude /snapshot.json
write snapshot.json locally, spawn: rclone copyto <tmp> <remote>/runs/v1/snapshot.json
update the state file, print one JSON object
```

`--checksum` compares MD5 and size. An unchanged screenshot uploads once across five checkpoints.

## 4. The workflow calls the package, not rclone

The excludes, the read-only files, the refusal of an existing destination, the digest, the run
numbering, the env mapping, and the JSON output live in one tested package. Workflow files call
`task-packet-store fetch`, `begin`, and `checkpoint` the way they call the exporter.

## When not to use rclone on a server

- The server cannot run downloaded binaries. The fallback is `@googleapis/drive` inside this package
  behind `PacketTransport`.
- The server is a long-lived service. Then `rclone rcd` runs as a daemon and the package calls its
  HTTP API instead of spawning a process. GitHub Actions does not need this.

## Drive facts that matter

- Drive allows two files with the same name in one folder. A run directory has one writer, so the
  PoC never creates that state. `rclone dedupe` repairs it if it happens.
- Listings can lag a few seconds after a write. `begin` numbering across two concurrent runs can
  collide. `checkpoint` detects it.
- rclone's default OAuth client id is shared across all rclone users and rate limited. A company
  client id lifts the limit. Follow-up, not PoC.
