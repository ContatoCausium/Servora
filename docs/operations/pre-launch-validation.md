# Pre-launch validation — status (2026-10-23)

## 1. Completed validations
- Sign-in, sign-up, forgot-password pages load with no errors on desktop (1280), tablet (820), iPhone (390), Android (412).
- Protected routes `/`, `/team`, `/control` redirect signed-out visitors to `/auth?redirect=…` on all four sizes.
- Google and Microsoft sign-in providers are enabled on the backend (managed credentials).
- Unit tests: 13/13. Security suites last run: tenant isolation 43/43, store/team/billing/admin 68/68 (no RLS/RPC change since).

## 2. Not yet validated (needs a real operator account)
- Email verification and password reset delivery end-to-end (default sender until a domain is verified).
- Google/Microsoft full round trip, session persistence after reload, logout.
- Phase 3 signed-in screens (Dashboard, Locations, Team, Billing, Branding, Control Center, org/language switching, mobile nav).

## 3. Operator first-account steps
1. Open `/auth/signup`, register with the operator's real email (or use Google/Microsoft).
2. Click the confirmation link in the email; then sign in at `/auth`.
3. Tell the agent "account created" — the agent reads the user ID (no admin rights are granted).
4. Bootstrap runs only after the operator writes an explicit authorization + reason (see `platform-admin-bootstrap.md`).

## 4. External services requiring authorization
- Platform admin bootstrap (operator authorization + reason).
- Stripe test mode (operator approval before enabling payments).
- Sender email domain (operator-owned domain, DNS setup).
- MARAO owner identity + Location 2/3 details.

## 5. Production blockers
All items in section 4, plus independent security review and successful end-to-end integration tests.

## 6. Regressions
None observed on signed-out surfaces. Signed-in surfaces unverified (no account).

## 7. Recommended sequence
Operator account → admin bootstrap → Phase 3 signed-in validation → sender domain → Stripe test mode → security review → live billing.
