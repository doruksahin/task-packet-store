---
status: pending
step: 12
title: Cleanup
---

# Step 12. Cleanup

## Goal

The walkthrough repository has one packet path and no R2 code.

## Depends on

Step 10.

## Files in `AC-visual-walkthrough`

| File | Change |
| --- | --- |
| `packages/packet-store/` | Delete the directory |
| `package.json` | Remove `test:packet-store` from `scripts.test` and from `scripts` |
| `packages/README.md` | Remove the packet-store row |
| `README.md` | Remove every mention of R2 and `fetch-packet.mjs` |
| `docs/adr/ADR-0015-...md` | Keep as history. Status already says superseded after step 09 |
| `docs/storage-setup.md` | Replace the packet-store paragraph with a pointer to ADR-0016 |
| GitHub secrets | Delete `PACKET_STORE_ACCESS_KEY_ID` and `PACKET_STORE_SECRET_ACCESS_KEY`. Delete `WALKTHROUGH_STORAGE_TOKEN` when no workflow uses it |

## Steps

1. Branch `chore/remove-r2-packet-store`.
2. Apply the changes. `pnpm test`.
3. PR titled `chore: remove the R2 packet store`. Merge.
4. Delete the secrets.

   ```bash
   gh secret delete PACKET_STORE_ACCESS_KEY_ID --repo doruksahin/AC-visual-walkthrough
   gh secret delete PACKET_STORE_SECRET_ACCESS_KEY --repo doruksahin/AC-visual-walkthrough
   ```

5. Empty and delete the R2 bucket `ac-walkthrough-packets` in the Cloudflare dashboard after one
   more successful `walkthrough-lab` run.

## Done when

`pnpm test` is green. `grep -ri "r2\.cloudflarestorage\|fetch-packet" README.md docs .github` prints
nothing except the historical ADR-0015.

## Evidence

```text
```

## Rollback

Revert the PR. Restore the secrets from the password manager.
