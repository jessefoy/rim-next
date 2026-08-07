# Rooted in Mindfulness — Calm System Review

## Why this pass exists

The prior design had a strong visual identity, but the scale and repetition sometimes made every section feel equally important. Large hero titles, large section titles, large cards, gradients, badges, and supporting copy could all ask for attention at once. The result was beautiful in individual moments but tiring across a whole page.

This version does not abandon the design. It lowers its volume.

The guiding rhythm is:

**arrival → orientation → one clear decision → rest → deeper exploration**

## A concrete issue that was corrected

Several pages loaded Fraunces from Google Fonts while the shared CSS requested Newsreader. Those pages therefore fell back inconsistently, often to Georgia. Every page now loads the same type system:

- **Newsreader** for display headings and quotations
- **DM Sans** for body copy, schedules, navigation, forms, and practical details

That consistency matters as much as the choice of typeface itself.

## Typography

### Desktop

- Home hero: approximately 56–88px
- Inner-page hero: approximately 47–70px
- Program title: approximately 47–72px
- Section headings: approximately 36–54px
- Card headings: approximately 24–30px
- Body copy: 16px
- Lead copy: generally 17–22px
- Practical metadata: generally 11–14px

### Mobile

- Home hero: approximately 47–59px
- Inner-page hero: approximately 41–52px
- Section headings: approximately 34–43px
- Body copy: 16px

The smaller scale still feels editorial and contemplative, but a heading no longer consumes a full viewport unless the wording genuinely requires it.

## Header and navigation

The global header returns to the simplicity of the first concept:

- transparent over the hero;
- a clear wordmark and small botanical mark;
- six predictable public navigation labels;
- Member sign in visually separated without becoming the primary action;
- a familiar circular menu button on mobile.

The public navigation remains:

**New here · Programs · This week · Teachings · Community · About**

This keeps the information architecture understandable without hiding essential destinations in a mega-menu.

## Page-specific hero identities

The heroes now share structure but not color. The purpose is orientation, not decoration.

- **Home — sunrise:** warmth, possibility, and welcome
- **New Here — refuge:** peach, cream, and soft green
- **Programs — growth:** sage and quiet earth tones
- **This Week — clarity:** lake blue and pale green
- **Teachings — parchment:** warm gold and paper
- **Community — belonging:** layered greens with warmth
- **About — roots:** clay, earth, and softened green
- **Join — relationship:** dawn peach moving toward green
- **Support — generosity:** clay and warm paper
- **Program detail — category driven:** practice, study, community, or retreat theme supplied by the CMS

The page title, background, and ornament now work together as a location signal. Visitors should be able to feel that they have moved to a different part of the site before reading the navigation state.

## A semantic color system

Color is no longer assigned to individual program cards merely to create variety.

- **Warm gold / peach:** invitation, beginnings, and generosity
- **Lake blue:** time, online access, and schedule clarity
- **Sage green:** community, relationship, and growth
- **Parchment:** learning, study, and reflection
- **Deep moss:** primary actions, Dharma depth, and stable site structure
- **Paper:** neutral information and practical details

On the Programs page, color identifies the program family through a restrained vertical accent. Individual rows remain neutral so people compare content rather than color.

## Programs page

The page serves more than new visitors. It now supports:

- someone looking for one gathering this week;
- someone maintaining a regular meditation rhythm;
- someone seeking sustained Buddhist study;
- someone looking for peer support or spiritual friendship;
- a member opening the dashboard;
- someone considering retreat.

The hero is intentionally broad: **Ways to practice, learn, and connect.**

Three utility paths sit below the hero rather than competing with it:

1. Happening this week
2. Planning a first visit
3. Already part of RIM

Program groups remain visible—no filters, hidden tabs, or interaction knowledge required. Each row shows:

- what the program is;
- a short description;
- schedule;
- format;
- commitment;
- an explicit details action.

The whole row is clickable, while the visible action tells less experienced web users what to do.

## This Week

The schedule uses familiar calendar cues:

- one date block per day;
- event name first;
- purpose or newcomer note second;
- time and format in a consistent location;
- one route to program details.

It does not require a legend because each event states its format directly. Weekend dates use a warmer accent; weekdays use lake blue. That is a light distinction, not a code someone must memorize.

## Program template and CMS behavior

The program page remains a compact landing page rather than an event database dump.

Required content:

- program type;
- title;
- short promise;
- schedule;
- format;
- commitment;
- experience level where relevant;
- cost or dana language;
- one primary action;
- approximately 120–260 words of description.

Optional blocks:

- quotation;
- program rhythm or highlights;
- facilitator;
- related teaching;
- accessibility and arrival details;
- prerequisites;
- series dates.

Empty optional fields should remove the entire block. The layout does not depend on every program having the same title length or all metadata fields.

The CMS can map a category to one of four body classes:

- `program-theme-practice`
- `program-theme-study`
- `program-theme-community`
- `program-theme-retreat`

This gives program pages appropriate color differentiation without allowing editors to assign arbitrary colors item by item.

## People who are less comfortable with technology

The revision favors visible, familiar interaction patterns:

- primary buttons are approximately 50px high;
- body copy is never intentionally reduced below 16px;
- schedules do not depend on hover;
- program content is not hidden behind filters;
- links use explicit labels such as “Program details,” not only arrows;
- mobile layouts preserve reading order;
- forms retain persistent labels;
- the member dashboard places today’s session links first;
- dashboard navigation wraps on small screens instead of requiring an unexplained horizontal swipe;
- all audited pages fit 360px screens without document-level horizontal overflow.

## How the pages serve the visitor journey

- **Home:** emotional recognition, one practical invitation, and evidence of a deeper path
- **New Here:** transparency, safety, and literal first-visit information
- **Programs:** the full ecology of practice, not only beginner offerings
- **This Week:** immediate action and schedule clarity
- **Program Detail:** enough meaning and logistics to decide
- **Teachings:** tradition, rigor, and freely offered substance
- **Community:** belonging, friendship, and shared care
- **About:** roots, purpose, teacher, and institutional honesty
- **Join:** account access and deeper membership clearly distinguished
- **Support:** generosity and service as practice
- **Login / Dashboard:** operational clarity for people already participating

## What remains prototype content

- live CMS collections;
- registration actions;
- account creation and password reset;
- Zoom links;
- teaching-library destinations;
- current dates and schedules;
- actual community-care agreements;
- program category theme mapping;
- production form handling.

Those systems should be connected without changing the hierarchy established here.
