# Email delivery (prepared, not sending)

Templates: `src/lib/email-templates.ts` — `renderEmail(kind, lang, vars)` returns subject/HTML/text in en-US and pt-BR for
`confirm_account`, `password_reset`, `invitation`, `invitation_accepted`, `security_notice`. Values are HTML-escaped, colors and
links are validated (https only).

## Current state
- Confirmation and password-reset emails are sent by the auth service with its default (unbranded) design.
- Invitations are shared by link from Team & access; the UI does not claim an email was sent.
- Acceptance and security notices are not sent.

## To activate (needs a verified sending domain)
1. Verify a sender domain (e.g. `notify.<your-domain>`) in Lovable Cloud email settings.
2. Auth emails: scaffold branded auth templates and port the copy from `renderEmail` (both languages; pick language from the user's `preferred_language`).
3. App emails: one server-side sender function (never the browser) triggered after `create_invitation`, `accept_invitation`,
   and audited security events (role change, ownership transfer, platform role change). Recipient and content are derived
   server-side from the database, not from request input.
4. Log every send attempt; respect suppression lists; no email contains secrets beyond the single-use action link.
5. Only then change the UI copy to say "invitation sent".
