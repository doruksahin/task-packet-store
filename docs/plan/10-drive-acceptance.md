---
status: done
step: 10
title: Prove the complete Drive flow
---

# Step 10. Prove the complete Drive flow

## Outcome

Both user commands work from a Jira ticket with no Drive packet, and a second walkthrough preserves
the first run. This is the delivery acceptance step.

## Owner, dependencies, and inputs

- Owner: `AC-visual-walkthrough`, with an operator who can open the Drive results.
- Depends on completed steps 08 and 09, available on the repository's default branch.
- Inputs: a suitable test ticket, shared store config, and the versions recorded by steps 06/08/09.
  `PROJ-123` below is the neutral example; record the actual selected ticket in evidence.

## Work

1. Confirm that the chosen ticket destination is absent. If the earlier development ticket already
   has output, use another suitable ticket or an isolated test-store prefix. Record the starting
   state without deleting existing packets or runs.
2. Run the first user command:

   ```bash
   gh workflow run jira-to-packet.yml \
     --repo doruksahin/AC-visual-walkthrough \
     -f ticket=PROJ-123
   ```

   Wait for that exact Actions run to complete. Record its run URL/ID rather than inferring success
   from whichever run happens to be latest. Verify the packet files through its Drive link and
   retain the producer digest.
3. Run the second user command:

   ```bash
   gh workflow run walkthrough-lab.yml \
     --repo doruksahin/AC-visual-walkthrough \
     -f ticket=PROJ-123
   ```

   Verify its independent runner fetches the recorded packet identity and saves `runs/v1/`.
   Retrieve the HTML through the reported Drive file link and open it. Check the rendered results
   and embedded/referenced evidence, and verify the run's evidence files and records are stored.
4. Run the second command once more. It must save `runs/v2/`. Retrieve the earlier run again and
   compare its recorded snapshot/file hashes to prove that `v1` remains intact.
5. Confirm both workflows are available in GitHub's Actions UI with the same ticket input. Record
   the operator's access to the Drive links. A third full capture run from the UI is unnecessary.
6. Save the evidence below and update the plan board only after all completion criteria pass.

## Done when

- The first command creates the packet on Drive; the second consumes that same packet.
- Independent CI runners complete the flow without a user's vault, local upload, or local pull.
- The saved HTML opens from the retrieved Drive file and contains the walkthrough results.
- `v1` and `v2` are present, and `v1`'s saved content is unchanged after the repeat.
- The packet, report, and run links work for the intended operator.
- The walkthrough keeps the agreed lab/draft semantics; a stored report does not imply all ACs pass.

## Evidence

Both commands passed. Repeating the walkthrough created `v2`, and a fresh read-only fetch/pull
confirmed that all 701 stored `v1` files were unchanged. Independent acceptance review cleared the
required operator contract after checking the actual receipts and completed comparison.

| Check | Evidence |
| --- | --- |
| Starting state | On 2026-09-05, the intended operator's Drive connector listed the complete, empty `packets` folder (`1JlWfAw3yRk3-l2mBObMqRb3vhTyYW8ks`) on Shared Drive `0APywiuwYbmGMUk9PVA`. The chosen ticket is `ATT-5387`; no packet or runs existed. |
| Jira → packet | User command with `ATT-5387` succeeded in [run 33962806577](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33962806577) at `08307480cce07cfcab32d94df1359d1055f5d9d5`. Store `0.1.0`, exporter `0.5.0`, profile `ac-walkthrough-packet-v1`. [Packet on Drive](https://drive.google.com/drive/folders/1B4PV0MlE0O_JoWyNbksZoiPq2s8L-BiZ). Full receipts are recorded in step 08. |
| Packet identity | Producer, both walkthroughs, independent fresh fetches, and both run records all record `2502dacdd4f4f70a13a4b8416d84cc70dd3e7bf5d398b223e9532558285f7653`. |
| First walkthrough | [Run 33962860607](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33962860607) succeeded; run key `github-33962860607-1`, version `v1`. [HTML](https://drive.google.com/file/d/1cX-sJugWQhZaeUE8KKShPybuC-W4JIcN/view), [run folder](https://drive.google.com/drive/folders/1ZarF3q5Bay8deEzayJHdfIxHH7UqSAQb). |
| Saved output | Human Drive retrieval and independent stored-file verification agree on HTML SHA `274d73754a8bf15e31d38186339d01ec7ec71f073c8fc4d54889e6a75f86f442` (985,530 bytes). The exact HTML renders visibly in isolated Chrome with embedded evidence. Final snapshot inventory SHA `dffc612dda5d513acfb58a67ca802c9934ef7d49d5b48ed8236fdc17f1775b75`; complete v1 byte-manifest SHA `c81b81fca4998fb0c8cb5d28ecac4ae0c084634b1057921984338634e618641c`, frozen before dispatching the repeat. |
| Repeat walkthrough | [Run 33964047130](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33964047130) succeeded in 12m40s at the same source commit, reserving `v2` with run key `github-33964047130-1`. [HTML](https://drive.google.com/file/d/1EaKLaJMx0zb0GroPTqQY-SSFxxnjCCbh/view), [run folder](https://drive.google.com/drive/folders/1eiOT7zPNuml_05VclQtA0q1Hv_v5yX4d). The comparison found exactly `v1` and `v2`, validated both snapshots, and confirmed every v1 path, size, and SHA unchanged. |
| Operator access | The operator's Drive account listed the packet, Jira files, run/evidence/trace directories and retrieved the HTML. Chrome's authenticated GitHub Actions UI exposed both workflows on `main` with a ticket field and Run workflow button; no duplicate UI run was submitted. |

The snapshot intentionally inventories the non-hidden report payload. Independent verification also
compared every stored hidden `.capture-session` file. Step 09 records
the draft's nine `Needs evidence` outcomes and the existing runner-local trace-shortcut limitation;
the actual trace is stored and accessible through Drive.

The operator's Drive connector retrieved v2 HTML (1,980,288 bytes), matching the renderer receipt
and stored-file SHA `d0ed22225affb5621f55348e015c314f7f8bd7b7abcd9f0e4d93dcc4742504ea`.
It renders visibly in isolated Chrome in light/dark modes, with 18 decoded embedded images and no
JavaScript errors. Both drafts retain `Needs evidence` for the nine ACs because the mock target
cannot reach the Script step. The store allocated `v2`; the fresh runner's internal version remains
`v1`, so the actual filename is `runs/v2/delivery/ATT-5387-ac-verification-v1.html`.

V2's final snapshot contains 15 payload files with inventory SHA
`ed2e5ad1a5dcd1715bbc6fa370523f2e6ea60dd3173cfec2f0d9aa41ef4cda69`.
Its complete stored-file manifest SHA is
`09bfe0abdc9ef666c4ea39eb52c08561654eeca919e529658eddc538c7db9196`.
The preserved [v1 baseline](evidence/2026-09-05/v1-baseline.json) and
[comparison receipt](evidence/2026-09-05/comparison.json) make the full-byte proof durable.
Comparison receipt SHA-256: `3c071583a32a37361f0ce2e9f2ab0734d8f738f2eeb6b856ed886b9da8f5dc1f`.

## Handoff and rollback

Passing this step completes the required Drive delivery. Optional vault integration, Recon, and
cleanup can follow. A failed check leaves this step unfinished and points back to its owning
implementation step; retain failed-run evidence and existing Drive output.
