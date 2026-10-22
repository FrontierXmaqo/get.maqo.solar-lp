# respond.io Workflow: residential sales links

> **Superseded.** The emoji pair is no longer added to WhatsApp messages. Routing now uses the Ref Code (`ref_code`) saved in Lark, and the chat is matched to the Lark row by the `Ref: MQ-XXXXXX` first line of the WhatsApp message. Kept for reference only.

Every WhatsApp message from a residential page opened through a sales link (`/?r=S02`) ends
with that salesperson's emoji pair, for example `… ☀️⭐`. This workflow reads the pair from the
first message and assigns the conversation to that salesperson.

Anything marked **[verify]** was not confirmed in respond.io's help docs. Check it in the
Workflow builder before you rely on it.

## The codes

The source of truth is `malaysia/ref/salespeople.json`. Replace the `SALES_X` placeholders with
real names there, and use the same pairs below.

| Code | respond.io user | Emoji pair | Tag |
|---|---|---|---|
| S01 | SALES_A | ☀️⚡ | `ref-S01` |
| S02 | SALES_B | ☀️⭐ | `ref-S02` |
| S03 | SALES_C | ☀️✅ | `ref-S03` |
| S04 | SALES_D | ☀️✨ | `ref-S04` |
| S05 | SALES_E | ☀️⛅ | `ref-S05` |
| S06 | SALES_F | ☀️⚽ | `ref-S06` |
| S07 | SALES_G | ☀️☕ | `ref-S07` |
| S08 | SALES_H | ☀️⛳ | `ref-S08` |
| S09 | SALES_I | ☀️⏰ | `ref-S09` |
| S10 | SALES_J | ☀️⌚ | `ref-S10` |

Copy each pair from this table or from the JSON file. Don't retype it: `☀️` is two characters
(U+2600 and U+FE0F), and a sun typed without the second one won't match.

## ⚠️ Before you start: check for conflicting workflows

1. Go to **Workflows** and open every **Published** workflow.
2. List each one whose trigger is **Conversation Opened**, especially any that use **Assign To**
   (round robin, team assignment and so on).
3. These run on the same event as this workflow. If one of them also assigns, the last one to
   run wins, and a sales-link lead can end up with the wrong person. respond.io doesn't document
   which workflow runs first **[verify]**.
4. Choose one of these fixes:
   - **Recommended:** move the existing assignment steps into this workflow's **Else** branch
     (step 6), then unpublish the old workflow, so there is only one Conversation Opened workflow
     that assigns.
   - Or, in the old workflow, add a first Branch that skips assignment when the last incoming
     message contains any of the pairs (or when **Referrer** is not empty).

## 1. Create the Referrer contact field (once)

1. **Settings → Contact Fields → Add Field** **[verify: menu path]**.
2. Name: `Referrer`. Type: **Text**.
3. Save.

## 2. Create the workflow and trigger

1. **Workflows → Add Workflow → Start from scratch**.
2. Name it `Resi sales link assignment`.
3. Trigger: **Conversation Opened**.
4. Trigger condition: **Source** · **Is equal to** · **Contact**. This means the customer messaged
   first, which is what an incoming message is.
5. WhatsApp only: the Conversation Opened trigger has no channel filter, only **Source**. If you
   have other channels, add a channel check as the first Branch (step 3), for example the
   category **Last Interacted Channel** · **Is equal to** · your WhatsApp channel
   **[verify: category name]**. If WhatsApp is your only channel, skip this.
6. **Advanced settings:** let contacts re-enter the workflow, so a returning contact is checked
   again on each new conversation **[verify: toggle name]**.

## 3. First-touch check: keep an existing referrer's owner

1. Under the trigger, click **+ → Branch**. Name it `Already referred?`
2. **Branch 1**, named `Has referrer`:
   - Category: **Contact Field**, field **Referrer**, operator **Is not empty**
     **[verify: operator name]**.
   - Under this branch, add no assignment step. Leave it empty, or add **Add Comment**
     ("Returning referred contact, owner kept"). The contact keeps its existing assignee.
3. The **Else** branch continues with step 4.

**[verify]** Check whether your workspace unassigns contacts when a conversation closes
(**Settings → Workspace → Auto-unassign on close**, or similar). If it does, a returning
contact has no owner to keep. In that case, under `Has referrer`, add a Branch on **Contact
Field Referrer Is equal to S01 … S09 (and S10)** with an **Assign To** to that user in each
branch: the same pattern as step 4, but matching the field instead of the message.

## 4. Match the emoji pair (S01–S09)

Under the **Else** of `Already referred?`:

1. **+ → Branch**. Name it `Sales link emoji`.
2. **Branch 1**, named `S01`:
   - Category: **Last Incoming Message**.
   - Operator: **Contains** **[verify: operator label]**.
   - Value: `☀️⚡` (paste it).
3. Click **Add Branch** and repeat for S02 to S09. One branch per salesperson. The step allows at
   most **9 branches plus Else**.

Under **each** branch S01 to S09, add these three steps in order:

1. **Update Contact Field** → field **Referrer** → value `S01` (that branch's code).
2. **Update Contact Tag** → Action **Add Tag** → `ref-S01`. Type it and create it if it doesn't
   exist.
3. **Assign To** → **Specific User** → that salesperson's respond.io user.
   - Leave the online-only and timeout options off, so the lead goes to them even if they are
     offline **[verify: option labels]**.

## 5. The 10th salesperson (S10): a nested Branch

The Branch step is full at 9 branches, so:

1. On the **Else** of `Sales link emoji`, click **+ → Branch**. Name it `Sales link emoji 2`.
2. **Branch 1**, named `S10`: **Last Incoming Message** · **Contains** · `☀️⌚`.
3. Add the same three steps: Referrer = `S10`, tag `ref-S10`, Assign To SALES_J.
4. The **Else** of `Sales link emoji 2` is the real "no sales link" path (step 6).

Salespeople 11 to 18 go into `Sales link emoji 2` the same way, and a third nested Branch covers
more than 18.

## 6. Else: no emoji, so use the existing assignment

On the last Else (`Sales link emoji 2` → Else), pick one of these:

- **Recommended:** copy in the steps of your current assignment workflow (from the warning above).
- Or **Trigger Another Workflow** → your existing assignment workflow **[verify]: that workflow's
  trigger must allow being started this way**.
- Or leave it empty, if you keep your existing Conversation Opened workflow running and have
  made it skip sales-link contacts (see the warning).

## 7. Publish and test

1. Click **Publish**.
2. Run `docs/referral/TEST_CHECKLIST.md`.

## Notes

- Matching is on the **first message** that opens the conversation. A customer who deletes the
  emoji before sending falls through to Else, which is expected.
- **[verify]** Check that **Last Incoming Message** holds the message that opened the
  conversation at the moment Conversation Opened fires. Test case 5 in the checklist covers it.
- **[verify]** Emoji matching: confirm that **Contains** matches emoji exactly as received
  (variation selector U+FE0F included). Test case 1 covers it.
- Adding a salesperson: add a row to `salespeople.json` with a new pair that starts with `☀️`,
  and add a branch here.
- Removing a salesperson: delete the row and the branch. Visitors who stored that code get no
  emoji from then on.
