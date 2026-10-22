# Reading the hidden ref id in Make

The home page form's WhatsApp message no longer shows `Ref: MQ-XXXXXX`. The id is hidden as
30 invisible characters right after the first word "Hi", so the customer sees a normal message:

```
Hi Maqo Solar, I'd like a free solar quotation. My details:
Salutation: Mr
...
```

The Lark row still gets the plain `ref_id` (`MQ-XXXXXX`) and `ref_code` (`S01`… / `T00`) from the
website, as before. Make has to turn the invisible characters back into `MQ-XXXXXX` to find that row.

## How it is encoded

- Only two invisible characters are used: U+200B (zero-width space) = `0` and U+200C (zero-width
  non-joiner) = `1`.
- The 6 characters after `MQ-` are each written as 5 bits, which is that character's position in
  `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (A = 00000, B = 00001 … 9 = 11111). 6 × 5 = 30 invisible characters.
- The code lives in `assets/js/restore.js` (`hiddenRef`).

## Make: replace the old "Ref:" parsing

Where the scenario used to read `Ref: MQ-…` from the respond.io message, add **Tools → Set
multiple variables** with these two variables. `{{message}}` is the respond.io message text
mapped from the earlier module.

**1. `bits`**

```
{{replace(replace(replace(encodeURL(1.message.message.text); /^.*?((?:%E2%80%8B|%E2%80%8C)+).*$/; "$1"); /%E2%80%8B/g; "0"); /%E2%80%8C/g; "1")}}
```

Make's formula editor can't hold the invisible characters inside a regex (it fails with
"Invalid IML … Unexpected ["), so `encodeURL` first turns them into plain text: U+200B becomes
`%E2%80%8B` and U+200C becomes `%E2%80%8C`.

**2. `key`** (paste as plain text)

```
00000A00001B00010C00011D00100E00101F00110G00111H01000J01001K01010L01011M01100N01101P01110Q01111R10000S10001T10010U10011V10100W10101X10110Y10111Z110002110013110104110115111006111017111108111119
```

Then add a second **Set variable**, named `ref_id`, using `bits` and `key` from the module above:

```
MQ-{{substring(key; indexOf(key; substring(bits; 0; 5)) + 5; indexOf(key; substring(bits; 0; 5)) + 6)}}{{substring(key; indexOf(key; substring(bits; 5; 10)) + 5; indexOf(key; substring(bits; 5; 10)) + 6)}}{{substring(key; indexOf(key; substring(bits; 10; 15)) + 5; indexOf(key; substring(bits; 10; 15)) + 6)}}{{substring(key; indexOf(key; substring(bits; 15; 20)) + 5; indexOf(key; substring(bits; 15; 20)) + 6)}}{{substring(key; indexOf(key; substring(bits; 20; 25)) + 5; indexOf(key; substring(bits; 20; 25)) + 6)}}{{substring(key; indexOf(key; substring(bits; 25; 30)) + 5; indexOf(key; substring(bits; 25; 30)) + 6)}}
```

Put a **filter** before the Lark search: `length(bits)` **Equal to** `30`. No hidden id means
the customer didn't come from the form, or the characters were stripped; handle it the way the
old scenario handled a message without `Ref:`.

Then search the Lark table for `ref_id` = `{{ref_id}}`, as the scenario did before.

**[verify]** in Make:
- `replace` accepts `/[^​‌]/g` with `\u` escapes. If not, paste the two invisible
  characters themselves into the pattern.
- `indexOf` and `substring` count from 0, like JavaScript.

## Test it end to end

1. Open `<preview>/?r=T00` in an incognito window, fill in the form and submit.
2. Note the new Lark row's `ref_id`.
3. Send the WhatsApp message as it is.
4. In Make's run history, `ref_id` must equal the Lark row's id, and the row must get its
   Contact ID.

If `bits` comes out empty in Make, WhatsApp or respond.io stripped the invisible characters and
this method can't work. Tell the developer; the fallback is a visible line such as
`Enquiry No: MQ-XXXXXX`.
