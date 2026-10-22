# Test checklist: residential sales links

> **Superseded.** The emoji pair is no longer added to WhatsApp messages. Routing now uses the Ref Code (`ref_code`) saved in Lark, and the chat is matched to the Lark row by the `Ref: MQ-XXXXXX` first line of the WhatsApp message. Kept for reference only.

`<preview>` is the branch preview URL. Use a **private/incognito window for every code**: the
first valid code is kept for 30 days in the browser, so a second code in the same window won't
change anything (by design).

To see a link's message without opening WhatsApp: right-click it → **Copy link address**, then
paste it into the address bar of another tab. Or open DevTools → Console and run:

```js
[...document.querySelectorAll('a[href*="wa.me/"]')].map(a => decodeURIComponent(a.getAttribute('href').split('?text=')[1] || '(no text)'))
```

Test phone: use a WhatsApp number that isn't already a contact in respond.io, or delete the test
contact between runs (except case 7).

## 1. Each code (S01 to S10)

For each row, in a fresh private window:

| Code | Open | Message must end with | respond.io user | Referrer | Tag |
|---|---|---|---|---|---|
| S01 | `<preview>/?r=S01` | ☀️⚡ | SALES_A | S01 | ref-S01 |
| S02 | `<preview>/?r=S02` | ☀️⭐ | SALES_B | S02 | ref-S02 |
| S03 | `<preview>/?r=S03` | ☀️✅ | SALES_C | S03 | ref-S03 |
| S04 | `<preview>/?r=S04` | ☀️✨ | SALES_D | S04 | ref-S04 |
| S05 | `<preview>/?r=S05` | ☀️⛅ | SALES_E | S05 | ref-S05 |
| S06 | `<preview>/?r=S06` | ☀️⚽ | SALES_F | S06 | ref-S06 |
| S07 | `<preview>/?r=S07` | ☀️☕ | SALES_G | S07 | ref-S07 |
| S08 | `<preview>/?r=S08` | ☀️⛳ | SALES_H | S08 | ref-S08 |
| S09 | `<preview>/?r=S09` | ☀️⏰ | SALES_I | S09 | ref-S09 |
| S10 | `<preview>/?r=S10` | ☀️⌚ | SALES_J | S10 | ref-S10 |

- [ ] Home page (`/`): nav **Contact Us** ends with the pair.
- [ ] Home page: footer **Tel: 6018-777 1095** ends with the pair.
- [ ] Home page form: fill it in → the preview under the button ends with the pair → **Submit** →
      WhatsApp opens with the same message.
- [ ] Contact page (`/let-the-sun-pay-for-you-contact/`, same window, no `?r=`): nav **Contact
      Us**, the **Contact Us** button and the footer **Tel** all end with the pair.
- [ ] Contact page form: submit → the **Chat on WhatsApp** button's message ends with the pair.
- [ ] No "S0X" code and no word "ref" appear anywhere on either page.
- [ ] Send one real message → in respond.io the conversation is assigned to the right user, the
      **Referrer** field shows the code, and the contact has the `ref-S0X` tag.
- [ ] Webhook (test mode: open `<preview>/?test_webhook=1` first): the lead in
      `TESTING_WEBHOOK_URL` has `ref_code` = the code.

## 2. Invalid code

- [ ] Fresh window, `<preview>/?r=S99` (also try `?r=abc`) → every WhatsApp link is plain
      `wa.me/60187771095` with no text, and the form message has no emoji.
- [ ] DevTools → Application → Local Storage: no `maqo_ref` key.
- [ ] Webhook lead: `ref_code` is empty.
- [ ] Send a message → respond.io uses the existing assignment (Else); Referrer is empty, no tag.

## 3. No code

- [ ] Fresh window, `<preview>/` → same as case 2: clean messages, existing assignment.

## 4. Case-insensitive code

- [ ] Fresh window, `<preview>/?r=s03` → messages end with ☀️✅.

## 5. Expired code

- [ ] Fresh window, open `<preview>/?r=S02`, then in DevTools → Console run:
      `localStorage.setItem('maqo_ref', JSON.stringify({code:'S02', at: Date.now() - 31*86400000}))`
- [ ] Reload `<preview>/` (no `?r=`) → messages are clean.
- [ ] Open `<preview>/?r=S04` → messages end with ☀️✨ (the expired code no longer blocks a new one).

## 6. First code wins

- [ ] Fresh window, open `<preview>/?r=S01`, then `<preview>/?r=S02` → messages still end with ☀️⚡.

## 7. Customer edits the text but keeps the emoji

- [ ] Fresh window `<preview>/?r=S05` → tap **Contact Us** → in WhatsApp, change the words but
      leave ☀️⛅ at the end → send → assigned to SALES_E, Referrer S05, tag `ref-S05`.

## 8. Customer deletes the emoji

- [ ] Fresh window `<preview>/?r=S06` → **Contact Us** → delete ☀️⚽ → send → existing assignment
      (Else), Referrer empty. Expected: without the emoji the chat can't be attributed.

## 9. Returning contact (first touch wins)

- [ ] Use the contact from case 7 (Referrer = S05). Close the conversation in respond.io.
- [ ] Fresh window `<preview>/?r=S07` → **Contact Us** → send.
- [ ] Contact stays with SALES_E, Referrer stays S05, and no `ref-S07` tag is added.

## 10. Storage blocked

- [ ] Chrome → Settings → block all cookies and site data for the preview domain → open
      `<preview>/?r=S08` → the page works and the messages end with ☀️⛳ (not remembered after
      leaving the page).

## 11. C&I and other pages are unchanged

In the same window as an active code (for example after case 1 S02):

- [ ] `<preview>/commercial-industry/`: every WhatsApp link is plain `wa.me/60187771095`, no
      text, no emoji. Submitting the form shows the usual **Chat on WhatsApp** message without
      emoji.
- [ ] Same for `/solar-battery-energy-storage-system/`, `/career/` and `/let-the-sun-pay-for-you-blog/`.
- [ ] Webhook C&I lead has no `ref_code` key.

## 12. Generator

- [ ] `<preview>/malaysia/ref/generator.html` shows 10 cards with links `<preview>/?r=S01` to
      `S10`.
- [ ] **Copy link** copies the link, and **Download QR** saves `maqo-S0X-qr.png`.
- [ ] Change **Base URL** to `https://get.maqosolar.com` → links and QR codes update.
- [ ] Scan a QR with a phone → it opens the right link.
- [ ] Page source has `<meta name="robots" content="noindex, nofollow">`, and no public page links
      to it.
