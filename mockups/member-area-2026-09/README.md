# RIM member area: simplified design study (revision 3)

September 21, 2026. **A prototype, not a shipped design or a production specification.**

Open `RIM-member-preview.html` in a regular browser. It is self-contained and works without a server or an internet connection. `index.html` is the equivalent source version and loads the adjacent assets. No application, database, Google Drive, Zoom, or email service is connected. All people, dates, schedules, and files shown here are sample content; Jesse's name is used as the preview identity.

## What to explore

- **My Home:** today’s sessions and one clear Zoom action. No team messages or previews of upcoming programs. Upcoming programs have their own destination. Routine preparation notes expand beside the session. The study control at the top switches between ready, later, and no-session states. It is a review control, not part of the proposed product.
- **Navigation:** My Home, Library, and My Teams are the three personal destinations. Profile and sign-out are in the account menu. Manage RIM is a header utility. Community Care is in the lower member rail and the mobile footer.
- **My Teams:** a directory replaces the growing list of teams in the sidebar. Each team home has three stable destinations: Conversations, Files, Members. A team with a main tool adds one task destination, such as Hosting schedule. No activity feed, recent-file previews, or message excerpts appear on the team home. Entering a team replaces the personal rail with its local navigation and an explicit way back to My Teams.
- **Conversations:** a searchable topic list, five conversations per page. Open a topic to read its message. The sample host team has eight topics so both pages can be explored.
- **My Profile:** separates biography, personal details, photo, sign-in information, and household. Edit a name or bio and save it to try the flow. No care agreements, administrative role badges, or team links are mixed into the form.
- **Files:** open Host team → Files. Search, change sorting, enter a folder, try My favorites, or use a file's three-dot button. Favorites, colors, and collection membership represent personal organization. Color preferences now have five quick swatches, a native picker for any custom color, and a No color option. Optional collection organization is under a disclosure in the preference dialog. File lists are limited to eight items per page. Adding a file to a collection leaves the shared file in place. Pins are visibly attributed and represent shared team choices by any member with editing access.
- **Community care:** gives the existing agreements a consistent destination. Agreement wording is copied from `lib/communityAgreements.ts`, not rewritten. It retains the source's existing provisional status.

Preferences and sample profile changes are saved only in this browser's local storage, under `rim-member-design-study-v1`. In this prototype, even team pins are simulated locally. Production would persist personal choices per member and shared pins per team/file, with access checks on every operation.

Secondary operations outside this first study (actual Zoom entry, course playback, administrative editing, email changes, household editing, uploads, sign-out) display a clearly labeled preview dialog. They do not perform the operation. Existing production workflows, including registration and deletion governance, remain intact.

## Design decisions

- Use RIM's Quincy CF and Open Sans, existing blue and Pampas tokens, pill actions, quiet surfaces, and functional rules. No new imagery or decorative motion.
- Give each screen a clear title, keep navigation destinations few, and preserve one local navigation layer in a team.
- Distinguish today's immediately usable action from later availability. Do not display an active Zoom button before the room opens.
- Keep preparation notes in the member context. The sample schedule view has no "Good to know" notes. This does not change the public application's listings yet.
- Personal organization never changes shared folders or widens access. Custom colors affect only the file marker, keeping names and controls in the readable RIM palette. A textual color description accompanies each marker; file identity never depends on color.
- Homepages stay the same size as content grows. Search, folders, and pagination belong inside their respective sections. No unbounded feeds or message excerpts on either homepage.
- Only routine preparation information goes in the Good to know disclosure. In production, cancellations, changed times, and information required to join must remain immediately visible.
- Manage RIM is shown for the sample administrator. Production must filter its visibility and destinations by actual authority. ADMIN alone must not grant entry to team content.

## Revision 3: shared readability

Primary interface text and controls now use 16px, secondary text 15px, and longer reading 18px, matching the new authenticated production CSS contract. Phone rules retain the same readable control and description sizes. Headings and features are unchanged.

## Validation and limits

- Revision 2: JavaScript syntax and packaged inline scripts checked. Source-level behavior checks passed for minimal homepages, custom color validation, picker markup, file pagination with 100 additional temporary sample files, conversation pagination, and searching from a later page. These checks executed rendering functions against a small in-memory element fixture, not a browser.
- The desktop and mobile screenshots in `review/` show **revision 1**. They are historical references and do not represent this simplified revision. Only revision 1 received visual browser inspection at 1280px and 390px.
- The Codex in-app browser previously refused a `file://` preview under its URL policy. No server, alternate browser launch, or navigation workaround was used after that refusal. The prototype’s latest revision still needs browser visual, keyboard, and native color-picker checks. Production stylesheet fixtures are tested separately without navigating to the local preview. Do not describe it as visually verified or as a complete accessibility audit.
- Referenced optional `/impeccable` and `/how-jesse-writes` skills were not found in the available local skill directories. The project design and copy guidance was used directly. New sample prose is provisional, pending Jesse’s review.

## Before production implementation

Confirm the visual direction with Jesse. Implement against the existing authenticated shell and `public/css/custom.css`; do not copy this isolated stylesheet into the app. Keep current session timing, registration, hosting, team access, and private-draft checks. Resolve personal file preference storage and shared pin permissions explicitly. Check the dashboard with no teams, no registrations, multiple available sessions, host early entry, and error/loading states using actual application data.

The prototype itself remains disconnected from live data. A separate typography-only production pass changes `public/css/custom.css` and project guidance. Application routes, schemas, permissions, integration code, and email templates remain unchanged.

## Assets

- Quincy CF and RIM logo: copied from this repository's existing `public/` assets.
- Open Sans: Google Fonts, downloaded for offline preview. Font source: `https://fonts.gstatic.com/s/opensans/v44/memvYaGs126MiZpBA-UvWbX2vVnXBbObj2OVTS-muw.woff2`.
- Icons: rendered from the project's installed `lucide-react` package.
- `RIM-member-preview.html` is a generated, self-contained copy of the source files. Update it whenever changing the prototype.
