# Restaurant onboarding validation

Validated October 23–26, 2026. **Not production-ready.** Payments remain disconnected; no paid services were activated.

## Completed flow

- Created **Juniper Table · Test** through authenticated onboarding, with fictional company name/address and first store.
- Creation explicitly classifies the persisted organization as demo/test. It is separate from browser-only Demo Studio, which still does not write data. Real customers are not created by this pre-launch flow.
- Selected the newly created restaurant before opening Branding.
- Uploaded test logos, generated palettes, applied themes, and confirmed persistence after page reload and a fresh browser session.
- Manually adjusted primary/accent colors and read them back after reload.
- Completed the five-step setup checklist and verified completion remains saved after reload. Checklist completion is a user acknowledgment, not proof that every optional action was performed.
- Configured fictional store address/hours; deactivated/reactivated stores; created a third store using the actual Add location form and saw it in the UI.
- Created scoped employee invitations. Acceptance remains blocked pending actual confirmation of disposable test-account emails; verification was not bypassed.

## Screens and layouts

Authenticated overview, Locations, Team, Branding and Billing were opened at desktop 1280×1800, tablet 768×1024, iPhone-sized 390×844 and Android-sized 412×915 viewports: **20 page visits**, no page errors or document-level horizontal overflow. These are browser viewport checks, not tests on physical devices. Screenshots were reviewed for representative mobile, tablet and desktop layouts.

English and Portuguese switching was exercised through the language menu. Dark mode was applied through account preferences and visually reviewed, then light mode restored. Platform-admin /control access remained available. A separate regular account navigating directly to /control ended at /onboarding, with no platform content displayed.

## Branding results

Test fixtures were simple two-color bitmap logos, not production restaurant logos:

| Palette | Extracted primary | Extracted accent |
|---|---|---|
| Red/yellow | #d6414a | #f2c540 |
| Teal/pink | #16707a | #e04a97 |
| Pale yellow/blue | #f6e768 | #81d3fe |

All six reported contrast pairs passed their thresholds for every fixture in both modes in automated tests (text/control pairs 4.5:1; focus ring 3:1). Navigation, preview cards/charts/buttons and workspace appearance used generated semantic tokens. Broader logo shapes, monochrome/transparent edge cases and physical-device color rendering remain unverified.

Branding is now stored in organization rows under tenant RLS, rather than authoritative localStorage overrides. Saves require an owner and an operational organization, validate colors and bounded raster-image data URLs, and write audit entries. SVG uploads are rasterized in the browser before persistence; raw SVG markup is rejected. This small-logo data-URL approach increases organization-row payloads and should be reconsidered for larger-scale storage. No public logo bucket or external media service was enabled.

## Persistence and store-limit evidence

- Company information, logo, colors, previous branding and onboarding progress read back from the backend.
- Starter allowance **1** rejected a second active store.
- Deactivating a store freed capacity; reactivating above the allowance was refused.
- The authorized platform operator selected **Growth trial** for Juniper only through the existing audited administration procedure; allowance became **3**, without collecting payment or overriding limits.
- Two stores were active after allowed reactivation; the third was created through the form. The final UI displayed Growth and **3/3** usage.
- Branding and store status changes appeared in the organization's protected audit log.

## Security evidence

A fresh targeted backend pass finished **22/22** checks:

- Separate regular outsider denied admin organization insights/list/audit RPCs, branding writes, onboarding writes and cross-tenant store creation.
- Regular account could not read Juniper or MARAO rows and had no platform-admin role.
- Platform operator retained administrator status but could not read MARAO through tenant RLS without membership.
- Owner store edit read back; deactivation and reactivation worked within Growth allowance.
- Invalid colors, raw SVG data and anonymous branding writes were refused.
- Scoped invitation creation worked; unconfirmed invitee acceptance was refused.
- Branding/store audit entries were present.

Initial script assertions mistakenly required HTTP 200 for void RPCs; their successful HTTP 204 responses were corrected, and the relevant checks rerun. This was a test-harness issue, not an authorization failure.

Automated application suite: **21/21 tests** passed, including added direct-link onboarding and varied-palette contrast coverage. Latest observed preview compilation was successful.

The legacy 43-check tenant-isolation and phased location/team suites were **not freshly completed**: their password sign-in setup requires confirmed test emails. Historical pass counts are not presented as current evidence. Full manager/staff invitation acceptance and assigned-store UI flows remain pending.

## UX issues found and corrected

1. Direct /onboarding?create=1 visits produced a blank page because numeric query values failed string validation; coercion and regression tests now cover this link.
2. Branding previously saved only in the browser and immediately claimed success. It now awaits authorized persistence and displays save failures.
3. Existing static tenant hydration could overwrite database branding/plan values; persisted fields are now authoritative while synthetic restaurant metadata is preserved.
4. Zero-store shell handling previously hid all pages; modules can now show their own appropriate empty states.
5. New setup/activity strings have English/Portuguese translations. Invitation activity says “created,” not “sent,” because email delivery is not configured.

## Remaining limitations and retained test state

- Disposable regular test accounts are unconfirmed; they received no administrator roles. They remain for continued verification, along with pending invitations to the staff test account.
- Juniper remains as a persisted fictional test restaurant owned by the operator who explicitly created it, with Growth trial, three fictional stores, saved logo and completed checklist.
- MARAO and Harbor Taco data/ownership were not changed. Existing additive schema defaults do not constitute ownership changes.
- Multi-organization switch/reload isolation needs a full two-owned-workspace UI test; outsider RLS denial is not a substitute.
- Network-failure injection, broad image-format/error cases, full manager/staff permissions, branded email delivery, real email confirmation round trips, and independent security review remain open.
- Stripe remains disconnected. No live charges, real customers, POS/KDS integrations or production-readiness claim.