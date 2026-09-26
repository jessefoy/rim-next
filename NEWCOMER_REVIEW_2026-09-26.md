# Newcomer review implementation — September 26, 2026

Jesse approved implementing the attached newcomer assessment. Copy remains provisional pending his read-aloud. The vault's website-copy document contains Revision 8 and addenda, saved before website edits.

## Confirmed decisions

- Recommend **Meditation and Dharma Talk** for a first visit; display its current database schedule and participation settings.
- Preserve the CARE handout text and diagram. Add a short everyday introduction only. Do not publish new four-pair teaching or replace the handout with glosses.
- Arrival: main entrance on the south side; parking in any surrounding building lot; upstairs access by stairs only, no elevator; restrooms in RIM's hall and elsewhere in the building. Do not label the restrooms accessible without evidence. Support email and center phone are contacts; phone calls go to messages handled by volunteers.

## Implemented

| Area | Change |
| --- | --- |
| Home | Concrete identity and location; early first-visit recommendation; shorter roots introduction; live directory categories; invitation to try one gathering; consistent giving language. |
| New to RIM | Recommended gathering; live schedule; account vs program registration; verified arrival/access; no unscheduled November promise; scoped experience, arrival, and support claims. |
| CARE / roots / why | Intro only before unchanged handout; CARE connected to the Buddhist teaching body; no automatic guide-delivery promise; less judgment of other learning; social/material hardship named. |
| Directory / schedule | Explicit participation labels and actual venue, including offsite locations; newcomer link; specific metadata. Labels use existing kind/access rules, not newly invented policies. |
| Program detail / registration | Practical facts and action before long prose; settings-derived voluntary/required giving before the form; closed-registration handling agrees with detail; no directions link on virtual-only programs. |
| Join / agreements | Shorter welcome; no dues or attendance commitment; conduct distinguished from belief in the shared canonical wording; code next step; visible optional phone. |
| Sign-in | Neutral email example. Program and volunteer return destinations survive login, join, soft redirects, email-code entry, and resend in the same browser flow. Narrow path allowlist; authenticated return route applies membership/archive gates. |
| Giving / outreach / volunteer | Voluntary vs required amounts scoped consistently; recurring donation distinguished from account membership; funds distinguished; outreach belief language simplified; training is an inquiry; volunteer questions can go by email before account creation. |
| About / groups | CARE named in mission; public teacher and contact links; familiar group language; proposal distinguished from launch; group listing uses kind rather than a brittle category name. |
| Accessibility | Persistent newsletter labels and native validation; controlled navigation disclosures with expanded state, keyboard Escape/focus/outside close; generated custom-question IDs in registration and update forms; existing saved answers preserved. |
| Authored records | One-time guarded copy migration fixes morning AM/evening close-day text, unmatched Art quote, explains selected unfamiliar heart-practice terms, scopes qigong claim, simplifies Nature display name without changing slug. Fills only an empty public Jesse profile, using existing About facts. |

## Remaining facts / decisions

- Pending response: October retreat $175 voluntary vs required; Essential Dharma Study registration policy; fundraiser format and RSVP rule. Existing operational settings stay unchanged pending that response. Display now reflects actual checkout/access behavior.
- Foundations dates and format; any guide/handout delivery promise; other facilitator biographies and publication permission.
- Recovery group confidentiality, optional sharing, recordings; actual qigong adaptations; Nature weather/access/park-fee rules and registration period; retreat access and cancellation terms. Program-specific operational facts require the organizer.
- Account data/privacy statement and an independent concern-handling contact require RIM's actual policy. No assurances invented.
- Group guidelines retain existing policy; deciding required vs recommended arrangements needs the coordinator. Long-form editorial restructuring can follow that decision.
- Real newcomer observation, screen-reader testing, and transactional signup/newsletter/payment checks remain human or explicitly authorized checks. No real registrations, subscriptions, emails, or payments submitted in this review.

## Verification

- `npx tsc --noEmit`: passed.
- ESLint on changed form/navigation/core public surfaces: zero errors; three existing image-element warnings.
- `node --check prisma/migrate.mjs` and `git diff --check`: passed.
- Focused offline regression checks: all four custom question types without legacy `_key`; unique IDs and label associations; multiple update forms; saved and removed-question answers; newsletter labels; voluntary/fixed/base donation summaries; participation and offsite venue; hostile return URL rejection; exact CARE teaching/diagram preservation. Passed.
- Local production build intentionally not run: it executes production migrations. Build and public UI verification follow GitHub/Vercel deployment.
- The installed `/impeccable` skill was not found in available skill locations. Direct keyboard, layout, semantics, and contrast checks are used; no claim of running that skill.

Known return-flow limit: signing in using the email button on a different device, a verification-error restart, or a legacy account's welcome/reactivation detour still lands on My Home. Ordinary same-browser signup/sign-in returns to the originating offering. No tokens or destinations were added to email templates.
