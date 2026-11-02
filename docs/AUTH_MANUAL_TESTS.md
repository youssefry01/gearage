# Manual test guide: authentication (M5a-2)

Use a **private window** per scenario. Run `npm run dev` (or a production build with `npm run build && npm start`).
Emails: with `EMAIL_PROVIDER=log` they are files in the folder named by `EMAIL_LOG_DIR` (default `.emails/`); with
Brevo, check the inbox and Brevo's Transactional log. Use `+` addresses (`you+t1@gmail.com`) to make many accounts.

## 1. Register

1. `/en/register`: submit empty: every required field shows an error under it and focus moves to the first.
2. Fill in, password `password1234`: the strength meter says Very weak or Weak. Type `tuba-mango-zephyr-quartz-81`: Good or Strong.
3. Untick the terms box and submit: "You need to accept to continue." Tick it and submit.
4. You land on `/en/verify-email?email=...`. **Check the email**: one message, a 6-digit code, "valid for 10 minutes", your language, brand name from the config, no password in it.
5. Database check (psql): `select "emailVerified","termsAcceptedAt","termsVersion","privacyAcceptedAt","marketingConsent","marketingConsentAt","phone" from "user" order by "createdAt" desc limit 1;` shows `false`, both timestamps set, `+20...` phone; `marketingConsentAt` is null unless you ticked marketing.
6. `select left(password,40) from account order by "createdAt" desc limit 1;` starts with `pv1:$argon2id$v=19$m=65536,t=3,p=1$`.

## 2. Verify

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
