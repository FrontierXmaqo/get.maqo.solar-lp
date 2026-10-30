# respond.io AI Agent: assign referred leads to their salesperson

The home page form asks **"Were you referred by any salesman?"**. If the client answers Yes and picks
a name, the WhatsApp message they send ends with one extra line:

```
Hi Maqo Solar, I'd like a free solar quotation. My details:
Salutation: Mr
Name: Ahmad
...
Preferred Communication Language: English
Referred by: Hugo Wong
```

If they answer No, there is no `Referred by:` line and the message is the same as before.
The old per-salesperson pages (`/?r=S02`) are gone.

The names come from `malaysia/ref/salespeople.json`. The name in the message is always written
exactly as in that file, so it can be matched word for word.

| Name in the message | respond.io user |
|---|---|
| Muhammad Hazman | Muhammad Hazman |
| Hugo Wong | Hugo Wong |
| Stella Phan | Stella Phan |
| Jing Hong Kua | Jing Hong Kua |
| Jeff It | Jeff It |
| Lee Wei Yang | Lee Wei Yang |
| Frontierx Maqo | Frontierx Maqo (test only: shown on *.vercel.app test sites, not on get.maqosolar.com) |

## What to change in the AI Agent

Anything marked **[verify]** is a menu or option name not checked in your workspace.

### 1. Allow the agent to assign

**AI Agents → open your agent → Actions** **[verify: tab name]**:

- Turn on **Assign** (assign to a user) and allow all seven users above.
- Turn on **Add Comment** and **Update Contact Tag** if you want the comment and tag in step 3.

### 2. Add this to the agent's Instructions

Paste it at the top of the Instructions, so it runs before any other assignment rule:

```
REFERRED LEADS (check this first, on the customer's first message)
If the customer's first message has a line that starts with "Referred by:", it is a referred lead.
1. Read the name after "Referred by:". Match it exactly to one of these respond.io users:
   Muhammad Hazman, Hugo Wong, Stella Phan, Jing Hong Kua, Jeff It, Lee Wei Yang, Frontierx Maqo.
2. Assign the conversation to that user. Do not use round robin or any other assignment rule.
3. Add the tag "Source-Referral" to the contact.
4. Add this internal comment:
   📌 Referral Lead
   This customer was referred by <name>. Please follow up on their solar enquiry and proceed with the usual sales process.
5. Reply to the customer as usual (thank them and say <name> will follow up with them).
If the name does not match any user in the list exactly, do not guess. Use the normal assignment rules.
If there is no "Referred by:" line, use the normal assignment rules.
Never change the assignee later because of a "Referred by:" line in a later message.
```

### 3. Check for other assignment

If a **Workflow** (trigger **Conversation Opened**) or the AI Agent's own rules also assign new
chats (round robin, team), it can override the referral assignment. Either:

- make that workflow skip messages that contain `Referred by:`
  (Branch → **Last Incoming Message** · **Contains** · `Referred by:` → do nothing), or
- move its assignment into the AI Agent's "normal assignment rules".

The old emoji workflow (`Resi sales link assignment`) is no longer needed: unpublish it.

## Lark Base

The lead webhook now fills these from the picked name:

- `salespartner` = the salesperson's name (for example `Hugo Wong`)
- `ref_code` = their code (`S02`)
- `tags` = `Source-Referral`

No-referral leads have all three empty (unless a partner link set `salespartner`).

## Test

1. Open the test preview in a private window, fill in the form, tick **Yes**, pick **Frontierx Maqo**,
   tick the Terms box and submit.
2. The WhatsApp preview under the button ends with `Referred by: Frontierx Maqo`.
3. Send the WhatsApp message as it is.
4. In respond.io: the chat is assigned to Frontierx Maqo, the contact has the `Source-Referral` tag
   and the conversation has the "📌 Referral Lead" comment.
5. Repeat with **No**: there is no `Referred by:` line and the normal assignment runs.
6. Delete the test contacts afterwards.
