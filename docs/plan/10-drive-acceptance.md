---
status: pending
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

Live runs remain pending. Record observed results in this table:

| Check | Evidence |
| --- | --- |
| Starting state | On 2026-09-05, the intended operator's Drive connector listed the complete, empty `packets` folder (`1JlWfAw3yRk3-l2mBObMqRb3vhTyYW8ks`) on Shared Drive `0APywiuwYbmGMUk9PVA`. The chosen ticket is `ATT-5387`; no packet or runs existed. |
| Jira → packet | User command with `ATT-5387` succeeded in [run 33962806577](https://github.com/doruksahin/AC-visual-walkthrough/actions/runs/33962806577) at `08307480cce07cfcab32d94df1359d1055f5d9d5`. Store `0.1.0`, exporter `0.5.0`, profile `ac-walkthrough-packet-v1`. [Packet on Drive](https://drive.google.com/drive/folders/1B4PV0MlE0O_JoWyNbksZoiPq2s8L-BiZ). Full receipts are recorded in step 08. |
| Packet identity | Producer digest and each walkthrough's recorded input digest |
| First walkthrough | Actions run URL/ID, run key/version, report and run links |
| Saved output | HTML-opening result, evidence/record inventory, snapshot/file hashes |
| Repeat walkthrough | Actions run URL/ID, v2 links, comparison showing unchanged v1 |
| Operator access | The intended operator's Drive account listed the packet and Jira files and read `00 Packet.md`. Chrome's authenticated GitHub Actions UI exposed both workflows on `main` with a ticket field and Run workflow button; no duplicate UI run was submitted. Report access remains pending. |

## Handoff and rollback

Passing this step completes the required Drive delivery. Optional vault integration, Recon, and
cleanup can follow. A failed check leaves this step unfinished and points back to its owning
implementation step; retain failed-run evidence and existing Drive output.
