# First platform administrator — one-time bootstrap

Servora never grants platform privileges from the app. The first administrator is created by an
authorized operator through a privileged backend call. After that, admins are managed only in the
Control Center (audited, reason required, last admin protected).

## Preconditions
1. The person has signed up in Servora and **confirmed their email**.
2. The business owner has **explicitly authorized** this person in writing (keep the record).
3. No platform administrator exists yet.

## Procedure (operator)
1. Look up the user id of the confirmed account (backend → Users).
2. Run, with the service role (backend SQL runner or a server-side script — never the browser):
   ```sql
   select public.bootstrap_first_platform_admin(
     '<user-uuid>',
     'Authorized by <name> on <date> via <channel>; identity checked by <method>'
   );
   ```
3. Ask the person to sign out and back in; "Control Center" appears in their menu.

## Guarantees enforced by the database
- Callable only by `service_role` (EXECUTE revoked from `anon`, `authenticated`, `PUBLIC`).
- Requires a confirmed account (`email_confirmed_at`), selected by user id — not by email alone.
- Requires an authorization note of at least 10 characters.
- Fails if any platform admin exists or if the bootstrap already ran (`platform_bootstrap` singleton row).
- Writes `platform.bootstrap_admin` to `audit_logs` with the note.

## If the bootstrap must be redone
It cannot be repeated by design. Use the Control Center from an existing admin. If every admin
account is lost, recovery is a manual, documented database intervention by the platform owner.
