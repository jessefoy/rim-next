# Rooted in Mindfulness — Design Refinement Notes

## What was creating the feeling of clutter

The first Version 2 was visually coherent, but several pages gave too many elements comparable emphasis:

- very large display headings competed with supporting copy and artwork;
- multiple full-size sections appeared one after another without enough change in visual density;
- filters, category links, cards, badges, and metadata all asked to be scanned at once;
- on mobile, the display type occupied too much of the first viewport;
- gradients were used beautifully, but not always selectively enough to establish hierarchy.

The refinement keeps the visual identity while applying a stricter rule: **one dominant idea per section, one primary action per decision point, and color used to group content rather than decorate every element.**

## Typography system

### Display face

The display face was changed from **Fraunces** to **Newsreader**. Newsreader retains a literary, contemplative character but has more conventional letterforms and is easier to read in long titles, ampersands, dates, and program names.

### Body face

**DM Sans** remains the body and interface face. It provides a quiet contrast to the serif headings and keeps practical details, buttons, schedules, and forms easy to scan.

### Refined scale

Desktop:

- Hero / H1: `56–98px`
- Section / H2: `40–64px`
- Card / H3: `25–34px`
- Lead copy: `19–23px`
- Body copy: `16.5px`
- Metadata: `11–14px`

Mobile:

- Hero / H1: `48–62px`
- Section / H2: `37–48px`
- Card / H3: `24–29px`
- Lead copy: approximately `17–18px`
- Body copy: `16px`

Headings use tighter line-height and modest negative tracking. Body copy uses generous line-height and constrained reading widths. This preserves elegance without allowing display type to overwhelm the task on the page.

## Spacing and proportion

The core content width is now `1280px`, with a reading width of approximately `720px`.

- Standard desktop section spacing: approximately `110px`
- Standard mobile section spacing: approximately `74px`
- Large cards use fewer but more meaningful interior gaps
- Related content is grouped inside a common surface or border
- Unrelated content is separated with a larger change in space, background, or composition

This creates a clearer rhythm of **arrival → focus → rest → next focus**.

## Homepage refinements

- The hero is shorter and the title is less dominant on mobile.
- The reassurance points remain visible but no longer collide with the landscape artwork.
- “What to expect” was reduced from four equally weighted columns to three distinct, contained cards.
- The weekly preview is enclosed in a quiet surface so it reads as one practical unit.
- The colorful Practice / Understanding / Community cards remain, but their height and symbol scale were reduced.
- Tradition and the three circles were combined into one dark-green section. This removes one full page section while strengthening the relationship between Dharma depth and wider ethical purpose.
- Member access and newsletter content remain separate, lower-priority closing actions.

## Programs page refinements

The filter-heavy directory was replaced with the stronger category-led approach from the earlier concept:

1. Open practice & learning
2. Silent meditation
3. Community groups
4. Retreats & special programs

Each family has its own heading, short orientation, generous separation, and CMS-ready collection container. Program cards use a two-column grid at larger sizes, reducing visual competition and providing enough room for titles, descriptions, time, and format.

Gradients return as meaningful category accents:

- warm sunrise
- quiet water
- grove green
- neutral paper

The cards still support database fields and conditional badges. The layout does not depend on every program having the same title length or optional metadata.

## This Week refinements

The schedule returns to a date-led structure:

- a strong date marker anchors each day;
- the event name is the primary row element;
- purpose or newcomer information is secondary;
- time and format occupy a consistent location;
- each event row has one clear route to its detail page.

The page avoids filters, legends, and controls that are not necessary for choosing a gathering. On mobile, each date becomes a compact horizontal marker and event logistics move beneath the title.

## Program detail refinements

The page retains the book-jacket model:

- title and promise on the left;
- practical facts and primary action on the right;
- a concise narrative description;
- optional program rhythm / highlights;
- optional facilitator;
- one closing invitation.

The hero was shortened, the title scale was reduced, and the main reading copy was tightened. The template still collapses safely when optional CMS blocks are absent.

## Navigation

The main navigation remains:

**New here · Programs · This week · Teachings · Community · About**

**Member sign in** remains visually distinct. Join and Support stay contextual and in the footer rather than competing with the public visitor’s first action.

## Mobile checks

The refinement was rendered and checked at `390px` width and at desktop size. Key changes include:

- smaller, more stable hero typography;
- full-width primary actions;
- one-column program cards;
- date-led schedule rows that reflow without horizontal scrolling;
- a repaired one-column program-detail cover;
- mobile navigation retained;
- no document-level horizontal overflow across the twelve prototype pages.

## Versions preserved

- Restored earlier design: `/mnt/data/rim-homepage`
- First Version 2 concept: `/mnt/data/rim-homepage-v2`
- This refinement: `/mnt/data/rim-homepage-v2-refined`
