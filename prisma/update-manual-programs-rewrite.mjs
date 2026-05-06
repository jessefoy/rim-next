/**
 * update-manual-programs-rewrite.mjs — Option-B full rewrite of the
 * Programs chapter.
 *
 * Replaces the body wholesale with a fresh chapter built from the
 * actual Program Editor UI inventory (Turn 2 of the option-B work).
 *
 * The new chapter:
 *   - Is structured around the 7 tabs the editor actually has:
 *     Content · Schedule · Categories · Registration · Dana ·
 *     Dashboard · Visibility.
 *   - Calls out conditional behaviors where they matter (Open
 *     Access only for virtual/hybrid; venue fields only when not
 *     virtual; recurrence interval and days only when set).
 *   - Includes Teachers and Open Access — neither was in the
 *     original chapter.
 *   - Has no Google Meet content (replaced by LiveKit and the
 *     session room is documented in the host hub manual).
 *   - Uses 8th-grade plain language; no model names; references
 *     "the registrar" generically.
 *
 * This update runs after the option-C surgical patch
 * (update_older_manual_chapters_v1) — they don't conflict; this
 * one wholesale replaces the body so any earlier patches are
 * superseded.
 *
 * Idempotent at the record level. Wired into migrate.mjs with a v1 flag.
 */

const PROGRAMS_BODY = `<p>This chapter is for the registrar. It walks through the Program Manager — where programs are created, registrations are tracked, and everything about how a program is offered to members lives.</p>
<p>The Program Manager is at <strong>/tools/programs</strong>. From there, you can see every program at a glance, open any program to edit it, and create new programs. Registrations for each program are visible inside that program's detail page.</p>
<p>This chapter covers what the program list shows you, the seven tabs in the program editor, and a few behaviors worth knowing before you save.</p>
<h2>The program list</h2>
<p>When you open /tools/programs, you see a table of every program. The toolbar at the top has filters and a search box. Filters narrow the list:</p>
<ul>
<li><strong>All</strong> — every program.</li>
<li><strong>Open</strong> — programs with registration enabled and not closed.</li>
<li><strong>Has waitlist</strong> — programs with someone waiting.</li>
<li><strong>Needs attention</strong> — programs with a flag: waitlist, pending dana, or a spot just opened.</li>
<li><strong>Archived</strong> — programs that have been retired.</li>
</ul>
<p>The search box filters by program name and tagline as you type. The <strong>+ Add Program</strong> button at the right opens a fresh editor.</p>
<p>Each row shows:</p>
<ul>
<li><strong>Program</strong> — name, with the tagline below.</li>
<li><strong>Format</strong> — In-person, Virtual, or Hybrid.</li>
<li><strong>Registration</strong> — whether registration is enabled, closed, or off.</li>
<li><strong>Capacity</strong> — current count over capacity, with a bar that turns yellow as it fills and red when full. If a confirmed spot is available and someone's on the waitlist (a cancellation freed a gap), a green <strong>Spot opened</strong> badge appears here.</li>
<li><strong>Flags</strong> — pending dana count and other things that need attention.</li>
<li><strong>Actions</strong> — Edit, Archive, Restore, Delete.</li>
</ul>
<p>Click a program name to open its detail page — the editor appears, and the registration list is reachable from there.</p>
<h2>Creating or editing a program</h2>
<p>When you open a program (or click <strong>+ Add Program</strong>), the editor opens with seven tabs across the top. The bottom of the page has a <strong>Save</strong> button that's always visible. Clicking another tab doesn't save — you save when you're done. The system warns you if you try to leave with unsaved changes.</p>
<p>The seven tabs are: <strong>Content</strong>, <strong>Schedule</strong>, <strong>Categories</strong>, <strong>Registration</strong>, <strong>Dana</strong>, <strong>Dashboard</strong>, and <strong>Visibility</strong>.</p>
<p>Each tab has its own fields. Below is what each tab covers and what to know about each field.</p>
<h2>Tab 1 — Content</h2>
<p>This is where the public-facing description of the program lives. What members see on the program page comes mostly from this tab.</p>
<p><strong>Name</strong> is the program title. It appears on the public site, in member dashboards, and in every email about the program. It's required.</p>
<p><strong>Slug</strong> is the URL path — <code>/programs/morning-sit</code>, for example. It auto-fills from the name when you're creating, but once a program is live, the slug is locked by default. You can unlock it to change, but doing so breaks every existing link to the program — emails, bookmarks, host assignments. Treat the slug as permanent unless you have a real reason to change it.</p>
<p><strong>Tagline</strong> is a one-liner shown below the name on the Programs page and in search results.</p>
<p><strong>Program Image</strong> is the main image for the program — shown on the public program page and in the listing. Landscape images work best. Click to upload from your computer.</p>
<p><strong>Description</strong> is the full program description shown on the public program page. Use the rich text editor — it supports headings, lists, links, and dharma blocks like pull quotes and verse blocks. Write for someone who's never been to RIM.</p>
<p><strong>Pull Quote</strong> is an optional highlighted quote shown on the program page — something that captures the spirit of the offering. <strong>Pull Quote Source</strong> is who said it.</p>
<p><strong>Program Notes</strong> is for additional notes shown on the public program detail page — scheduling context, accessibility info, what to bring, anything that doesn't fit in the main description.</p>
<p><strong>Teacher / Facilitators</strong> lets you link teachers to the program by searching for their name. Selected teachers appear as removable tags. Linked teachers automatically get host controls during virtual sessions — they don't need a separate host assignment.</p>
<h2>Tab 2 — Schedule</h2>
<p>The when and the where.</p>
<p><strong>Schedule Label</strong> and <strong>Time Label</strong> auto-generate from the recurrence pattern and the start and end times. You'll see something like "Tuesdays" or "7:00–8:30 PM CT" appear automatically. If the auto-generated text isn't right, type your own — once you do, it sticks. Clear the field to go back to auto-generation.</p>
<p><strong>Program Format</strong> picks one of three: <em>In-person</em>, <em>Virtual</em>, or <em>Hybrid</em>. This controls whether a venue address is shown and whether the Open Access section appears.</p>
<p><strong>Venue.</strong> When the format is in-person or hybrid, you pick: <em>At RIM</em> (the usual address fills in automatically) or <em>Other location</em>. Choosing Other location reveals two more fields:</p>
<ul>
<li><strong>Location Text</strong> — venue name and address shown on the program page and in emails.</li>
<li><strong>Location Link</strong> — a link to the venue (Google Maps, a directions page, the venue's website).</li>
</ul>
<p><strong>Open Access</strong> only appears for virtual or hybrid programs. When checked, the program generates a guest link that lets anyone join the session without registering or logging in. Useful for drop-in sessions where you don't want a registration step. After saving, a copyable link appears at <code>/session/[slug]?key=[guest-key]</code> with a <strong>Copy</strong> button next to it. There's also a <strong>Reset link</strong> option that invalidates the old link immediately and generates a new one — useful if a link has been shared too widely or you want a fresh start.</p>
<p><strong>Start Date &amp; Time</strong> and <strong>End Date &amp; Time</strong> are the basic when. Use the date pickers; times are in Central Time.</p>
<p><strong>Recurrence</strong> is for repeating programs. Pick <em>One-time</em>, <em>Daily</em>, <em>Weekly</em>, or <em>Monthly</em>. When you pick anything other than One-time, a few more fields appear:</p>
<ul>
<li><strong>Repeat every</strong> sets the interval — every 1 week, every 2 weeks, and so on.</li>
<li><strong>On days</strong> appears for Weekly recurrence. Pick which days of the week the program meets.</li>
<li><strong>Number of occurrences</strong> is the total count. Leave blank for ongoing programs (a weekly drop-in that doesn't end). Fill in for fixed-length series — 8 = an 8-week course.</li>
</ul>
<h2>Tab 3 — Categories</h2>
<p>Where the program lives in the public site's organization.</p>
<p><strong>Category</strong> picks a category from the existing list. Programs without a category don't appear on the public Programs &amp; Events page — useful for programs you want to keep findable by direct link but not promoted broadly.</p>
<p><strong>Category Display Order</strong> lets you arrange the order categories appear on the public Programs page. Drag categories into the order you want.</p>
<h2>Tab 4 — Registration</h2>
<p>Where you control whether and how people can register.</p>
<p><strong>Registration enabled</strong> turns the registration form on for the program's public page. When unchecked, visitors can read about the program but can't register.</p>
<p><strong>Registration closed</strong> is a manual override that closes registration even when it's enabled. The page shows a "Registration is closed" notice instead of the form. Useful when a program is full or after a deadline has passed and you want to leave the message clear.</p>
<p><strong>Capacity</strong> is the maximum number of registered participants. Leave blank for unlimited. When the program is at capacity, new registrations automatically go to a waitlist.</p>
<p><strong>Registration Deadline</strong> closes registration automatically after this date. Leave blank if there's no deadline.</p>
<p><strong>Custom Questions</strong> lets you add additional questions to the registration form. Each question has a label, a type (<em>Short text</em>, <em>Long text</em>, <em>Yes/No</em>, or <em>Select</em>), and an optional <em>Required</em> checkbox. Select-type questions take a comma-separated list of options. Use the up and down arrows to reorder questions, the <strong>Remove</strong> button to delete one, and <strong>+ Add Question</strong> to add another.</p>
<p><strong>Confirmation Message</strong> is the warm note in the email someone gets after they register. Logistics, what to bring, a personal welcome — anything you want them to read alongside the date and link.</p>
<p><strong>Reminder Date</strong> is when the system can send a reminder email. The reminder doesn't send automatically — set the date here, then go to the program's registration list when you're ready to send it manually.</p>
<p><strong>Reminder Message</strong> is the body of that reminder email.</p>
<h2>Tab 5 — Dana</h2>
<p>Dana — the practice of giving — is configured here.</p>
<p><strong>Dana Mode</strong> picks one of four:</p>
<ul>
<li><strong>None.</strong> No dana step. The form skips it entirely. Most drop-in programs use this.</li>
<li><strong>Voluntary.</strong> A suggested amount is shown. The participant can change it to any amount or skip with "No thank you." No obligation.</li>
<li><strong>Base + Dana.</strong> A required base fee (to cover costs) plus an optional dana on top.</li>
<li><strong>Fixed.</strong> A set price. Participants can't change it. Used for programs with a firm cost, like a retreat with accommodation.</li>
</ul>
<p>Depending on the mode, you'll see one or two amount fields:</p>
<ul>
<li><strong>Suggested Amount ($)</strong> — shown for Voluntary and Base + Dana.</li>
<li><strong>Base Amount ($)</strong> — shown for Base + Dana.</li>
<li><strong>Fixed Amount ($)</strong> — shown for Fixed.</li>
</ul>
<p><strong>Dana Step Message</strong> is the text shown during the donation step of registration. Use it to explain how dana supports RIM and what participants should know. There's a <strong>Template</strong> picker above the editor that loads a pre-written message — useful as a starting point.</p>
<p><strong>Program Page Dana Note</strong> is a brief note shown on the public program page near the registration form, so visitors understand the dana model before they start the form.</p>
<h2>Tab 6 — Dashboard</h2>
<p>Two fields that affect what appears on the program's card on member dashboards. Both are optional.</p>
<p><strong>Special Announcement</strong> is a bold notice shown on the dashboard card. Use it for urgent, time-sensitive information — a schedule change, a room reassignment, a heads-up the registered members need to see.</p>
<p><strong>Early Arrival Message</strong> is quieter — things like "Please arrive 10 minutes early" or "Bring a cushion." Practical guidance that doesn't need to be loud.</p>
<h2>Tab 7 — Visibility</h2>
<p>Where the program shows up on the public site and on member dashboards.</p>
<p><strong>Sort Order</strong> controls the program's place on the public Programs page. Lower numbers come first.</p>
<p><strong>Hide from public Programs &amp; Events page</strong> keeps the program off the main listing. The program is still accessible by direct URL.</p>
<p><strong>Hide from This Week's Schedule</strong> keeps the program off the weekly schedule page. Useful for special events or programs that shouldn't clutter the regular calendar.</p>
<p><strong>Hide from member dashboards</strong> keeps the program off member dashboard cards. Still accessible by direct link and on the public site.</p>
<p>When you hide from member dashboards, an optional <strong>Auto-show on dashboards</strong> date appears. Set a future date and the program will reappear automatically — no manual action needed. Useful when you want a program quiet for now but coming back later.</p>
<h2>Saving</h2>
<p>The bottom of the editor has a permanent <strong>Save</strong> button and a <strong>Cancel</strong> button. Save commits all your changes from all tabs at once. Cancel returns to the program list.</p>
<p>If you've made changes and try to leave (clicking another nav link, closing the tab, hitting back), the system warns you. If you really want to leave without saving, confirm — otherwise it stays where you are.</p>
<h2>A note</h2>
<p>The program editor is broad — seven tabs, dozens of fields. Most programs only need a few of them. A simple weekly drop-in is name, format, recurrence, capacity (or none), and a category. A retreat is more — registration questions, dana, possibly a reminder. As you work, the conditional fields show and hide based on your choices, so you only see what's relevant.</p>
<p>If something doesn't behave the way you expect — a field you expected to see is missing, a saved value disappeared, anything confusing — message Jesse. Programs are the spine of how RIM offers itself to the world; we want this page to feel reliable.</p>`;

export async function updateManualProgramsRewrite(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "programs" },
    select: { id: true },
  });

  const data = {
    title: "Programs",
    description: "How the Program Manager works — the program list, the seven editor tabs, and saving.",
    hubSlug: "registrar",
    body: PROGRAMS_BODY,
    relations: ["registration", "host-schedule"],
  };

  if (existing) {
    await db.manualSection.update({
      where: { slug: "programs" },
      data,
    });
    console.log("  ✔ Updated manual section: programs (option-B rewrite)");
  } else {
    await db.manualSection.create({
      data: { slug: "programs", order: 3, ...data },
    });
    console.log("  ✔ Created manual section: programs (option-B rewrite)");
  }
}
