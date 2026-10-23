# respond.io: comment and tag on referral leads

When a referral lead has been assigned to its salesperson, respond.io adds an internal comment to
the conversation and the `Source-Referral` tag to the contact.

This builds on the assignment you already have: respond.io assigns the lead to the salesperson
from the referral code (S01 to S06, T00 for testing). Nothing on the website changes.

Anything marked **[verify]** is a menu or option name that wasn't checked in your workspace.
Confirm it in the Workflow builder as you go.

## The comment

Copy this exactly, including the line break:

```
📌 Referral Lead
This lead was generated through the MAQO Solar Referral Landing Page. Please follow up with the customer regarding their solar enquiry and proceed with the usual sales process.
```

## Option A (recommended): add two steps after the existing Assign To

Use this if a respond.io Workflow already does the assignment from the referral code. The
comment and tag then run straight after the assignment, in the same run.

1. **Workflows** → open the workflow that assigns referral leads → **Edit**.
2. Find the **Assign To** step for one salesperson (for example the S01 branch).
3. Under it, click **+** → **Add Comment**. Paste the comment above. Save the step.
4. Under the comment, click **+** → **Update Contact Tag** → Action **Add Tag** → type
   `Source-Referral`. Create the tag if respond.io offers to. Save the step.
5. Repeat steps 3 and 4 under the **Assign To** of every salesperson branch, including T00.
   Don't add them to the Else (no referral code) branch.
6. **Publish**.

## Option B: a separate workflow

Use this if the assignment is done outside respond.io's Workflows (for example by Make through the
API), or if you'd rather not touch the assignment workflow.

1. **Settings → Contact Tags** **[verify: menu path]** → add `Source-Referral` if it doesn't exist.
2. **Workflows → Add Workflow → Start from scratch**. Name it `Referral lead comment and tag`.
3. Trigger: **Contact Assignee Updated** **[verify: trigger name]**.
4. **+ → Branch**, named `Referral lead?`. **Branch 1**, named `Yes`, with two conditions joined
   by **AND**:
   - **Contact Field** → the field that holds the referral code (the one your assignment reads,
     for example `Referrer`) → **Is not empty** **[verify: operator name]**.
   - **Contact Tag** → **Does not contain** **[verify: operator name]** → `Source-Referral`.
     This stops a second comment when the lead is later reassigned.
5. Under **Yes**:
   - **+ → Add Comment** → paste the comment above.
   - **+ → Update Contact Tag** → **Add Tag** → `Source-Referral`.
6. Leave **Else** empty.
7. **Advanced settings:** let contacts re-enter the workflow **[verify: toggle name]**. The tag
   condition in step 4 keeps each contact from getting the comment twice.
8. **Publish**.

## Test

1. In a private browser window, open
   `https://get-maqo-solar-lp-test-g31f6s8di-frontierx-8247.vercel.app/referral/?r=T00&test_webhook=1`.
2. Fill in the form with a test name and phone number, and submit.
3. In respond.io, once the contact is assigned to Frontierx Maqo (T00):
   - The conversation shows the internal comment, starting with "📌 Referral Lead".
   - The contact has the `Source-Referral` tag.
4. Option B only: reassign the contact to someone else. No second comment should appear.
5. Delete the test contact afterwards.

## Notes

- **Home-page sales links.** A customer who opens the home page with `/?r=S01` also gets a
  referral code. Either option above treats them as a referral lead too, so they get the same
  comment, which says they came through the Referral Landing Page. If you need to tell the two
  apart, the Lark row's landing page shows `/referral/` for the referral page.
- **WhatsApp.** The referral page shows a thank-you message after submit and doesn't open
  WhatsApp. If your assignment only runs when the customer messages first (Conversation Opened),
  tell the developer, so the page can open WhatsApp after submit like the home-page form does.
