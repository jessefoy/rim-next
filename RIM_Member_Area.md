# RIM Member Area — Engineering Reference

Updated 2026-09-22. Production implementation: `0627936`; shared typography: `b076413`. Signed-in visual and interaction review remains pending. `mockups/member-area-2026-09/` is a historical study, not the shipped application.

## Routes and responsibilities

| Surface | Route / implementation | Contract |
|---|---|---|
| My Home | `/account/dashboard`; authenticated dashboard page | Today’s active/later offerings, existing Zoom entry gates, preparation beside the offering |
| Upcoming programs | `/account/dashboard?view=upcoming` | Upcoming registrations and dana, 20 per page; no member cancellation |
| My Teams | `/account/teams` | Actual hub membership or GUIDING_TEACHER reach; ADMIN alone does not reveal content |
| My Profile | `/account/dashboard-my-profile`; `dashboard-my-profile/page.tsx`, `AboutMeSection` | Personal/contact details, sign-in email, photo/introduction, household |
| Community Care | `/account/community-care` | Canonical `lib/communityAgreements.ts`; reading page, no acceptance mutation |
| Shared navigation | `AccountLayout`, `AccountSidebar`, `Nav` | Flat personal rail; account menu; role-gated Manage RIM; contextual admin rail |
| Team Home | `/account/hub/[slug]`; `HubHomeClient` | Stable destinations and named disclosures; see hub engineering/model references |
| Team Files | `/account/hub/[slug]/files`; `FilesBrowser` | Member-owned organization, shared pins; see `RIM_GoogleWorkspace.md` §11 |

The profile URL retains its existing `dashboard-my-profile` spelling; moving its navigation entry does not rename the route.

## Design decisions

Jesse’s community includes people who are not comfortable with technology. Keep home pages minimal: show the next useful action, then clear destinations. Content volume belongs inside the destination, not in expanding home feeds. My Home has no team-message feed. Team Home retains newcomer welcome, editable guidance, attention, pinned conversations and schedule information through named disclosures; empty sections stay hidden. Team membership is a directory rather than an ever-growing sidebar.

All first-party authenticated surfaces use `public/css/custom.css` as their design authority: primary UI 16px, metadata 15px, reading content 18px, shared heading/control/focus treatment, 44px control targets. Member, admin and apps share the contract. Provider-rendered Google content retains its provider rendering. Shared rules do not establish that every signed-in screen has been visually verified.

## Connections and invariants

- Dashboard presentation depends on offering kind, registration state, session timing and host/teacher early entry. Preserve the existing gates and timed refresh. Exclude pending-payment/cancelled registrations as before. The upcoming view does not restore the retired `/account/programs` self-service management feature.
- Routine `earlyArrivalMessage` appears under Good to know beside member offerings. Public catalog and weekly schedule retain `specialAnnouncement` Updates; their shared `ProgramCardNotices` no longer accepts routine notes. Program editing and transactional email sources are unchanged.
- Profile writes keep their existing server action, `/api/account/bio`, `/api/account/avatar` and `/api/upload`. Avatar removal now reports HTTP failure instead of appearing successful. The user-bio editor remains the message variant.
- Community agreements share one text across join, welcome, registration, public agreements and member care. Moving the reading page does not change consent capture.
- My Teams follows the existing status-blind read door. Paused membership visibility is distinct from write authority. Manage RIM is a header destination for ADMIN/REGISTRAR, not a new permission grant.
- Hub queries, app installs and app links keep the resource hub context, including `?hub=`. Home rendering never switches behavior by a hardcoded hub slug.
- Personal file favorites/colors/sort are stored by authenticated member and place; shared pins require existing file write authority. They never change Drive colors, ordering or grants.
- `useNavigationDrawer` handles Escape, focus containment, body scroll lock and focus restoration for account/hub drawers. Header account menu also closes on Escape, outside pointer and navigation.

## Verification and follow-up

`node scripts/check-member-redesign.cjs` passed 68 isolated assertions covering actual route handlers/dashboard components with fixtures: authorization, personal ownership, pin gates, scoped listing, directory access, session entry timing and registration filtering. TypeScript and targeted lint passed (zero lint errors, two warnings). Production public listings were reviewed at 375 and 1280px without horizontal overflow and retained the urgent Update.

Still required after Jesse signs in: phone/desktop and keyboard review of My Home, profile, care, My Teams, a team home, Files, admin and installed apps; personal preference save/reload/isolation; shared pin visibility; existing file create/upload/share/removal paths with designated test content. No live Google, email or Zoom operations were exercised in the isolated checks. Do not claim full integration verification from compilation or mocks.

The Google list loader still caps each folder at 1,000 items; the new 20-row pages operate on that loaded set. Cross-folder/global search is not implemented. See the backlog for cursor-based loading.
