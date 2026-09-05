# Drive acceptance evidence — 2026-09-05

`v1-baseline.json` is the exact read-only stored-file inventory frozen before the second
walkthrough was dispatched. It includes all 701 stored files, including hidden capture-profile
files; no file contents or credentials are included. `v1.manifestSha256` is SHA-256 over
`JSON.stringify(v1.manifest)` using the array's recorded order. Each entry records its relative
path, byte size, and file SHA-256.

`comparison.json` is the exact completed comparison receipt. It records the three successful
Actions runs, package/input identity, both snapshots and report hashes, actual Drive links, and
`v1Unchanged: true` after a fresh read-only retrieval. Its SHA-256 is
`3c071583a32a37361f0ce2e9f2ab0734d8f738f2eeb6b856ed886b9da8f5dc1f`.
The baseline file's SHA-256 is `9446d5957f143853f22a23f5abccc4edc289f3eb80e67c58fd3c135471de326a`.

Temporary paths in the receipt describe the original verifier execution; the preserved baseline
in this directory is byte-identical to that original file. The
[acceptance record](../../10-drive-acceptance.md) records the human Drive access and visual checks.
