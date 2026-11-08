# Manual test guide: authentication and account (M5a-2, M5b-1, M5b-2a)

Use a **private window** per scenario. Run `npm run dev` (or a production build with `npm run build && npm start`).
Emails: with `EMAIL_PROVIDER=log` they are files in the folder named by `EMAIL_LOG_DIR` (default `.emails/`); with
Brevo, check the inbox and Brevo's Transactional log. Use `+` addresses (`you+t1@gmail.com`) to make many accounts.

## 1. Register

1. `/en/register`: submit empty: every required field shows an error under it and focus moves to the first.
2. Fill in, password `password1234`: the strength meter says Very weak or Weak. Type `tuba-mango-zephyr-quartz-81`: Good or Strong.
3. Untick the terms box and submit: "You need to accept to continue." Tick it and submit.
4. You land on `/en/verify-email` (the address is NOT in the URL; DevTools, Application, Cookies shows `auth.pending`: HttpOnly, SameSite Lax, about 30 minutes). The page says "If <your address> is new here, we've sent it a 6-digit code... If you already have an account with this address, we've emailed you instead" and has Sign in, Forgot your password? and Use a different email links. **Check the email**: one message, a 6-digit code, "valid for 10 minutes", your language, brand name from the config, no password in it.
5. Database check (psql): `select "emailVerified","termsAcceptedAt","termsVersion","privacyAcceptedAt","marketingConsent","marketingConsentAt","phone" from "user" order by "createdAt" desc limit 1;` shows `false`, both timestamps set, `+20...` phone; `marketingConsentAt` is null unless you ticked marketing.
6. `select left(password,40) from account order by "createdAt" desc limit 1;` starts with `pv1:$argon2id$v=19$m=65536,t=3,p=1$`.

## 1b. Form fields (M5a-3)

1. Phone field on `/en/register` (try it on a phone too): the telephone keypad opens, the placeholder is `01012345678`, you cannot type more than 20 characters or any letters, and Arabic digits (`٠١٠١٢٣٤٥٦٧٨`) turn into `01012345678` as you type. `01012345678`, `201012345678` and `+201012345678` all register; `select phone from "user" order by "createdAt" desc limit 1;` shows `+201012345678` for all three.
2. Cursor (desktop): hover "Create account", the theme and language switches, the footer links, the checkbox and its label: all show the hand. Hover a disabled button (for example "Create account" while it is sending): not-allowed.
3. Keyboard: Tab through the register form, the verify page and the account page: every control shows a visible focus ring.

## 2. Verify

0. Code field: the numeric keypad opens on a phone, the field takes digits only, the email's code pastes cleanly even as "123 456" or with spaces around it, and six digits submit themselves (no button press needed). On iOS and Android the keyboard offers the code from the email (one-time-code).
   0b. Open `/en/verify-email` in a private window (no cookie): you are sent to sign in. Wait 30 minutes on the page (or delete the `auth.pending` cookie) and try to submit: "This verification has expired. Sign in to get a new code, or register again."
1. Wrong code: "That code isn't right." Right code: you land on `/en/account` signed in ("Hello, <first name>").
2. Request a new code with "Send a new code": the message is the same whether or not the address exists. A second email arrives for a real unverified address.
3. Five wrong codes in a row, then the right one: refused (the code is used up); request a new code.

## 3. Login, logout, enumeration

1. Sign out, sign in: works. A wrong password for your address and for `nobody@example.com` show the **same** text and look the same.
2. Sign in to a never-verified account with the right password: you are sent to verify and get a fresh code.
3. `/en/login?next=//evil.example` then sign in: you land on `/en/account`, never on another site. `?next=/en/search` lands on search.
4. Register again with an address that already has an account: you land on the same verify page; the owner receives "You already have an account" and **no new code**.

## 4. Lockout

1. Five wrong passwords: the sixth attempt, even with the right password, says "Too many failed attempts. Try again in 1 min." (30 s rounds up to 1). Wait it out; the right password then works.
2. Do the same with an address that has no account: identical behaviour.
3. `select failures, "lockedUntil" from login_throttle;` shows rows with a hashed key (no email).

## 5. Forgot and reset

1. `/en/forgot-password`: the same confirmation for real and unknown addresses; only the real one gets an email.
2. **Check the email**: the link looks like `https://.../en/reset-password#token=...` with **no `?`**, valid 60 minutes.
3. Open the link twice (a scanner would): nothing is used up. Submit `short`: "Use at least 12 characters", and the link still works. Submit a good password: you go to sign-in with a success note.
4. The old password fails, the new one works, and any other browser that was signed in is signed out. Open the link again and submit: "invalid or has expired".

## 6. Session cookie flags (DevTools)

DevTools → Application → Cookies → your site. Find `auth.session_token` (over https: `__Secure-auth.session_token`).

| Column   | Expect                                                                   |
| -------- | ------------------------------------------------------------------------ |
| HttpOnly | ticked                                                                   |
| Secure   | **ticked in production (https)**; empty on `http://localhost` (expected) |
| SameSite | Lax                                                                      |
| Path     | `/`                                                                      |
| Domain   | the exact host only (no leading dot)                                     |
| Expires  | about 7 days ahead                                                       |

In the Console, `document.cookie` must **not** contain the session token. After sign-out the cookie is gone.

## 7. CSRF

1. Network tab, submit a wrong-password login. Select the POST to `/en/login` (it has a `Next-Action` request header).
2. Right-click → Copy → Copy as cURL (bash). Change the `origin:` header to `https://evil.example` and run it.
3. Expect an error status (not 200) and **no** `set-cookie`. The server log says "Invalid Server Actions request".
4. The same request with your real origin works, which shows the check is the origin and not something else.

## 8. Arabic and RTL

`/ar/register`, `/ar/login`: right-to-left, translated labels and errors, emails in Arabic (the Arabic text is machine-written, see docs/I18N_REVIEW.md). Email and phone inputs stay left-to-right.

## 9. Housekeeping job

`curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily` then check the log line `auth_pruned`. To see it delete something, set an unverified user's `createdAt` to 8 days ago first.

## 10. Profile (M5b-1)

1. Sign in, open `/en/account`: your name, email and mobile (as `01012345678`) are shown, with links to Profile and Security.
2. Open Profile. Change the first name and the mobile number, set a date of birth and a gender, **Save changes**. "Your details were saved." appears; reload and the values are still there; `/en/account` greets you by the new name.
3. In the mobile field type `12345`, save: "Enter an Egyptian mobile number like 01012345678". Paste 40 digits: the field stops at 17 characters. Type Arabic digits: they turn into 0-9.
4. Set a date of birth less than 16 years ago: a clear message. Clear the date and the gender, save, reload: both are empty.
5. Edit a field and try to close or reload the tab: the browser asks first. After saving it does not.
6. The email field is read-only.

## 11. Change password (M5b-1)

Use **two browsers** (A and B, for example Chrome and Firefox) signed in to the same account.

1. In A open `/en/account/security`. The hint under the new password says "You can use any language."
2. Wrong current password: "That isn't your current password." Nothing changes (B is still signed in: reload it).
3. New password equal to the current one: "Choose a password that is different from your current one."
4. A new password such as `a completely different passphrase 2026` (spaces, or Arabic words) is accepted: "Your password was changed. Your other devices were signed out and we sent you a confirmation email."
5. A stays signed in. Reload B: it goes to the sign-in page. The old password no longer signs in; the new one does.
6. The email "Your ... password was changed" arrives (Brevo inbox, or `.emails/`): it names the device ("Chrome on Windows") and has a **Reset password** button to the forgot-password page. Check it in Arabic too (`/ar/account/security`).
7. Rate limit: five or six wrong attempts in a row end with "Too many attempts" (the limit is 6 per 15 minutes per account).

## 12. Signed-in devices (M5b-1)

1. With A and B signed in, A's Security page lists two devices: this one marked "This device" (no button) and the other, such as "Firefox on macOS", with a **Sign out** button, the sign-in time and the last-active date. Times are in Cairo time.
2. **Sign out** the other device in A. The list updates and "Signed out of 1 device." appears (a screen reader reads it once; focus moves to the list); reload B: it is signed out.
3. Sign in on B again, and on a third browser C. In A press **Sign out of other devices**: both go; A stays; "Signed out of 2 devices." appears (polite live region) and the button is replaced by "You're not signed in anywhere else."
4. The normal **Sign out** (account page) ends only the device you press it on.
5. Everything above in Arabic (`/ar/account/security`): right-to-left, "Chrome على Windows" style labels.

## 13. Security activity (M5b-1)

At the bottom of the Security page, newest first: "Signed in on Chrome on Windows" for sign-ins, "Password changed", "Password reset by email", "One device was signed out", "Other devices were signed out". No IP addresses appear anywhere. In the database check that sessions have no raw User-Agent or IP:

```sql
SELECT device, "userAgent", "ipAddress" FROM session;   -- userAgent and ipAddress are NULL for new sessions
SELECT type, device, "createdAt" FROM security_event ORDER BY "createdAt" DESC LIMIT 10;
```

To see the 12-month cleanup: set an event's `createdAt` to 400 days ago, then run the housekeeping job (section 9); the log line `auth_pruned` includes `securityEvents`.

## 14. Reset by email sends the password-changed notice (M5b-2a)

1. Forgot password for a real account, open the link, set a new password.
2. An email "Your ... password was changed" arrives at that address (Brevo inbox or `.emails/`), in the language of the page you used. It names the device and says that **every device was signed out** (not "this device stayed signed in"), with a **Reset password** button. Try once from `/ar/forgot-password`: the email is Arabic.
3. The activity list shows "Password reset by email". A wrong or used link sends no notice.

## 15. Change email address (M5b-2a)

Use **two browsers** (A and B) signed in to the same account, and two real mailboxes you can read: the current one (OLD) and another one (NEW, for example a `+` alias).

1. A: Profile, **Change email address** (or `/en/account/email`). Wrong password: "That isn't your current password." Nothing is sent. The same address as your current one, in capitals: "That is already your email address."
2. Right password and the NEW address: the page changes to **Enter the code** with `n***@...` (masked) and "5 attempts left"; focus is on that heading.
3. OLD mailbox: "An email change was requested on your ... account": masked new address, the device, a **Cancel the change** button, 30 minutes. NEW mailbox: the 6-digit code (nothing about your old address).
4. Reload the page: the code step is still there. Type a wrong code: error and "4 attempts left". Press **Send a new code**: "If the address can be used, we've sent a new code."; the first code stops working.
5. Enter the right code: "Your email address was changed. Your other devices were signed out..." (focus moves to it); the current address shown above is the new one.
6. Reload B: it goes to sign-in. OLD mailbox: "The email address of your ... account was changed" with a **Contact us** button. The Security page's activity list shows "Email address changed".
7. Sign in with the NEW address and the same password: works. With the OLD address: "Incorrect email or password." "Forgot password" for the OLD address sends nothing. A reset link that was in the OLD mailbox before the change no longer works.
8. Five wrong codes in a row: "Too many wrong codes. Request a new one."; the page returns to the start and even the right code no longer works.
9. **Use a different address** returns to the form (no confirmation: nothing is lost). Activity list: "Email change cancelled".
10. Arabic (`/ar/account/email`): right-to-left, the address stays left-to-right and in the right place in the emails.
11. Expiry (optional): start a change and wait 30+ minutes, or set `expiresAt` in the past: `update email_change_request set "expiresAt" = now() - interval '1 minute';` then enter the code: "That code has expired. Request a new one." The page returns to the start.

## 16. Cancel link and an address that already has an account (M5b-2a)

1. Start a change (section 15, steps 1 to 3) but do not enter the code. Open the **Cancel the change** link from the OLD mailbox in a **private window with no session**: the page only shows one button (opening the link changes nothing; the address bar shows `#token=...`).
2. Press **Cancel the email change**: "The email change was cancelled...", advice to reset the password if you did not ask for it, and the token is gone from the address bar. In A, the code from the NEW mailbox now says "There's no email change in progress. Start again." Pressing the button again (or opening a used link) says the link is invalid or has expired.
3. Another account's address: start a change to an address that already has an account (use a second test account). The page says exactly the same as in section 15 step 2, and the OLD mailbox gets the same notice. The OTHER address's mailbox gets "Someone asked to use your email for another ... account" (no code). Any code you type fails with "That code isn't right" and the attempts counter.
4. Rate limits (optional, with `RATE_LIMIT_SCALE` unset): more than 3 requests to the same new address in an hour, or 5 requests from the account in an hour, end with "Too many attempts".

```sql
select "userId", "newEmail", left("codeHash",8) as code_hash, attempts, "expiresAt" from email_change_request;   -- only hashes, never the code
select type, "createdAt" from security_event order by "createdAt" desc limit 6;
```
