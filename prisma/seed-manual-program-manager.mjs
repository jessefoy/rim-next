/**
 * seed-manual-program-manager.mjs — Creates the Program Manager manual section.
 *
 * Called from migrate.mjs. Upserts a ManualSection. Body is BlockNote JSON at seed time; converts to HTML on first edit (lazy migration, session 97).
 * Idempotent: checked via migration flag in migrate.mjs.
 */

let _id = 0;
const uid = () => `man-pm-${++_id}`;

const t = (text) => ({ type: "text", text, styles: {} });
const b = (text) => ({ type: "text", text, styles: { bold: true } });
const i = (text) => ({ type: "text", text, styles: { italic: true } });

const p = (...parts) => ({
  id: uid(), type: "paragraph", props: {},
  content: parts.flat().map(part => typeof part === "string" ? t(part) : part),
  children: [],
});

const sp = () => ({ id: uid(), type: "paragraph", props: {}, content: [], children: [] });

const h = (level, text) => ({
  id: uid(), type: "heading", props: { level },
  content: [t(text)], children: [],
});

const li = (...parts) => ({
  id: uid(), type: "bulletListItem", props: {},
  content: parts.flat().map(part => typeof part === "string" ? t(part) : part),
  children: [],
});

export async function seedManualProgramManager(db) {
  const existing = await db.manualSection.findUnique({
    where: { slug: "program-manager" },
  });

  const body = [
    h(2, "Getting There"),
    p("The Program Manager is your main workspace for creating and managing programs. You can reach it two ways:"),
    li(b("From the Registrar Hub:"), " Open the sidebar and click ", b("Program Manager"), " under Tools."),
    li(b("Direct link:"), " Go to /tools/programs in your browser."),
    p("From any program editor, click ", b("Help →"), " in the top right of the page to return to this manual."),
    sp(),

    h(2, "The Program List"),
    p("The list shows all programs in a table with filter pills across the top:"),
    li(b("All"), " — Every active (non-archived) program."),
    li(b("Open"), " — Programs with registration currently open."),
    li(b("Has waitlist"), " — Programs where at least one person is waitlisted."),
    li(b("Needs attention"), " — Programs that need action: waitlisted people, pending dana payments, or an open spot."),
    li(b("Archived"), " — Programs you've archived. Hidden from everyone but still in the system."),
    sp(),
    p("Each row shows the program name, format (In-person / Virtual / Hybrid), registration status, capacity bar, and any flags. The capacity bar fills up as people register — it turns amber near capacity and red when full."),
    sp(),
    p("You can ", b("search"), " by name or tagline. To create a new program, click ", b("+ Add Program"), " in the top right."),
    sp(),
    p(b("Archiving:"), " Click Archive on any active program to hide it from all public and member-facing views. Restore it anytime from the Archived filter. Only Admins can permanently delete a program — and only after it's archived with no active registrations."),
    sp(),

    h(2, "The Editor — Seven Tabs"),
    p("The program editor has seven tabs. Each controls a different aspect of the program. Changes are not saved until you click ", b("Save"), " at the bottom. If you navigate away before saving, you'll see a warning."),
    sp(),

    h(3, "Content"),
    p("The basics: what the program is and who leads it."),
    sp(),
    li(b("Name *"), " — The title everyone sees everywhere: public site, member dashboard, emails. Required."),
    li(b("Slug *"), " — The URL path (e.g. ", i("/programs/morning-sit"), "). Auto-generates from the name. Locked by default when editing — unlock only if you need to change it. ", b("Warning: changing a slug after the program is live breaks existing links and host assignments.")),
    li(b("Tagline"), " — A one-line description shown on the Programs page and in search."),
    li(b("Program Image"), " — Shown on the program page header. Upload a landscape image. You can remove and re-upload at any time."),
    li(b("Description"), " — Full program description on the public page. Uses the rich text editor — supports headings, bullet lists, bold/italic, and more. Write for someone who has never been to RIM."),
    li(b("Pull Quote / Source"), " — An optional highlighted quote shown on the program page."),
    li(b("Special Notes"), " — Temporary notices shown on the public page — room changes, schedule adjustments, one-time notices. Remove when no longer relevant."),
    li(b("Teacher / Facilitators"), " — Search by name to link a teacher to this program. Linked teachers automatically get host controls in virtual sessions (LiveKit). You can link multiple teachers; remove any with ×."),
    sp(),

    h(3, "Schedule"),
    p("When and where the program happens."),
    sp(),
    p(b("Schedule Label"), " — How the schedule appears on the public site (e.g. 'Tuesdays and Thursdays' or 'April 14, 2026'). ", b("Auto-generates from your start date and recurrence settings"), " — if you leave it blank or clear it, it regenerates automatically. You can also type to override it."),
    sp(),
    p(b("Time Label"), " — Shown on program cards and in confirmation emails (e.g. '7:00–8:30 PM CT'). ", b("Auto-generates from your start and end times"), " — same rule: blank or cleared = regenerates. Type to override."),
    sp(),
    p(b("Date and Time Pickers"), " — All date/time fields use a custom picker: a date field, an hour selector, minute selector (in 15-minute increments), and AM/PM. Much easier than typing a datetime string."),
    sp(),
    p(b("Program Format"), " — In-person, Virtual, or Hybrid. Controls whether a LiveKit video room or a venue address is shown."),
    li(b("In-person"), " — Shows venue address. No virtual join link."),
    li(b("Virtual"), " — No venue. Shows LiveKit join button in the session area."),
    li(b("Hybrid"), " — Shows both. Members can join in person or virtually."),
    sp(),
    p(b("Venue"), " — For in-person and hybrid programs. 'At RIM' auto-fills the RIM address. 'Other location' lets you enter a custom venue name and optional map link."),
    sp(),
    p(b("Start Date & Time / End Date & Time"), " — When the program runs. For recurring programs, this is the first session's date. For single-day events, set both to the same date."),
    sp(),
    p(b("Recurrence"), " — For repeating programs. Choose:"),
    li(b("One-time"), " — Single event. No recurrence."),
    li(b("Daily"), " — Every N days."),
    li(b("Weekly"), " — Every N weeks on selected days. You'll see a day-of-week picker."),
    li(b("Monthly"), " — Every month."),
    p("Set the interval (e.g. 'every 2 weeks') and optionally the number of occurrences. Leave occurrences blank for ongoing."),
    sp(),
    p(b("Open Access (virtual/hybrid only)"), " — Generates a shareable guest join link that lets anyone join the virtual session without registering or logging in. Good for drop-in meditation sessions."),
    li("Check 'Enable guest access link' to turn it on."),
    li("Save the program — the guest link generates automatically."),
    li("Use the ", b("Copy"), " button to copy the link. Share it however you'd like."),
    li("If the link is compromised, click ", b("Reset link"), " to generate a new one. The old link stops working immediately."),
    sp(),

    h(3, "Categories"),
    p("Assigns this program to a section on the public Programs & Events page. Programs without a category won't appear on that page (though they're still accessible by direct link)."),
    sp(),
    p("Pick a category from the dropdown. You can also ", b("reorder categories"), " from here — drag the ↑↓ arrows to change the order they appear on the public page."),
    sp(),

    h(3, "Registration"),
    p("Controls who can sign up and what they see."),
    sp(),
    li(b("Registration enabled"), " — When checked, the public program page shows a registration form. When unchecked, visitors can read about the program but can't register."),
    li(b("Registration closed"), " — Manually closes registration. Shows 'Registration is closed' instead of the form. Use this when you need to close early regardless of capacity or deadline."),
    sp(),
    li(b("Capacity"), " — Maximum registrations. Leave blank for unlimited. When full, new registrations are automatically waitlisted."),
    li(b("Registration Deadline"), " — Registration closes automatically after this date. Leave blank for no deadline."),
    sp(),
    p(b("Custom Questions"), " — Add questions to the registration form. Each question has:"),
    li(b("Label"), " — The question text shown to the registrant."),
    li(b("Type"), " — Short text, long text, Yes/No, or Select (dropdown with options you define)."),
    li(b("Required"), " — Whether the registrant must answer before submitting."),
    p("Use ↑↓ to reorder questions. Answers appear in the registration detail view and in CSV exports."),
    sp(),
    li(b("Confirmation Message"), " — Shown in the confirmation email after someone registers. Use it for logistics like what to bring or how to prepare. Uses the prose editor."),
    li(b("Reminder Date"), " — When set, you can send a reminder email to all registrants from the registration detail page on or after this date."),
    li(b("Reminder Message"), " — The content of the reminder email. You send it manually — it doesn't go out automatically."),
    sp(),

    h(3, "Dana"),
    p("Controls how donations work for this program."),
    sp(),
    p(b("Dana Mode"), " — Four options:"),
    li(b("None"), " — No donation step. Registration goes straight to confirmation."),
    li(b("Voluntary"), " — Participants choose any amount. You can suggest a default."),
    li(b("Base + Dana"), " — A minimum amount is required; participants can add more on top."),
    li(b("Fixed"), " — An exact amount is charged. Participants cannot change it."),
    sp(),
    p(b("Amounts"), " — Shown when the relevant mode is selected:"),
    li(b("Suggested Amount"), " — Voluntary mode: pre-filled suggestion, participants can change it."),
    li(b("Base Amount"), " — Base + Dana mode: the minimum."),
    li(b("Fixed Amount"), " — Fixed mode: the exact charge."),
    sp(),
    p(b("Dana Step Message"), " — Rich text shown during the donation step of registration. Use this to explain how dana supports RIM and what the practice of generosity means."),
    sp(),
    p("Use the ", b("Templates bar"), " to load built-in messages or your own saved ones:"),
    li("Click a template chip to load it into the editor. This replaces whatever is currently there."),
    li("Click ", b("+ Save current"), " to save what's in the editor as a named template for future programs."),
    li("Click × on any chip to remove it. Built-in templates can be removed — click 'Restore default templates' at the bottom to bring them back."),
    li("To edit a saved template: load it, make changes in the editor, click ", b("+ Save current"), " and use the same name — it will overwrite the existing one."),
    sp(),
    li(b("Program Page Dana Note"), " — A brief note about dana shown on the public program page near the registration form. Different from the step message — this is public-facing, before anyone clicks to register."),
    sp(),

    h(3, "Dashboard"),
    p("Controls what members see on their program card in the member dashboard."),
    sp(),
    li(b("Special Announcement"), " — A bold notice on the dashboard card. Use for urgent or time-sensitive info like a schedule change or room assignment."),
    li(b("Early Arrival Message"), " — A quieter message on the dashboard card — things like 'Please arrive 10 minutes early' or 'Bring a cushion.'"),
    p("Both are optional. Leave blank if you don't need them."),
    sp(),

    h(3, "Visibility"),
    p("Controls where this program appears."),
    sp(),
    li(b("Sort Order"), " — Controls display order on the public Programs page. Lower numbers appear first. Programs without a sort order appear after sorted ones, alphabetically."),
    sp(),
    li(b("Hide from public Programs & Events page"), " — The program won't appear in the public listing. Still accessible by direct URL."),
    sp(),
    li(b("Hide from member dashboards"), " — The program won't appear on member dashboards. Still accessible by direct link and on the public site."),
    p("When you check this, an optional field appears: ", b("Auto-show on dashboards"), ". Set a date and time and the program will automatically reappear on member dashboards at that moment — no manual action needed. Good for announcing programs in advance: hide it until registration opens, then let it appear automatically."),
    sp(),

    h(2, "Editing a Program"),
    p("From the program list, click ", b("Edit"), " next to any program. You'll see the same seven tabs, pre-filled with the current settings."),
    sp(),
    p("A few things to know:"),
    li("The slug is locked by default. Unlock only if necessary — changing a slug after the program is live will break existing links and host assignments."),
    li("The ", b("View program page →"), " link at the top opens the public page in a new tab — handy for checking how changes look after saving."),
    li("The ", b("Help →"), " link opens this manual in a new tab."),
    li("Changes take effect after saving. The public page updates when Vercel deploys (~1 minute)."),
    sp(),

    h(2, "Managing Registrations"),
    p("Click a program name in the list to open the registration detail page."),
    sp(),
    p(b("The stat bar"), " at the top gives a quick picture: confirmed, waitlisted, cancelled, and pending dana. If the program has a capacity, you'll see a visual bar showing how full it is."),
    sp(),
    p(b("Spot opened alert:"), " If someone cancels and there's a waitlist, you'll see a notice: 'A spot has opened.' Use the Promote button to move the next waitlisted person to confirmed."),
    sp(),
    p(b("Filters and search:"), " Use the pills (All, Registered, Waitlisted, Cancelled) to narrow the list. Search by name or email. Export to CSV for a spreadsheet."),
    sp(),
    p("Click any row to expand it. You'll see three columns:"),
    li(b("Contact"), " — Name, email, phone, registration date."),
    li(b("Responses"), " — Answers to custom questions. Click Edit to update them if needed."),
    li(b("Actions & Notes"), " — Everything you can do with this registration, plus internal staff notes."),
    sp(),
    p(b("Actions you can take:"),),
    li(b("Promote to Registered"), " — Moves a waitlisted person to confirmed."),
    li(b("Send Dana Reminder"), " — Emails someone to complete their donation."),
    li(b("Send Reminder"), " — Sends the program reminder email to this person."),
    li(b("Resend Confirmation"), " — Re-sends the original confirmation email."),
    li(b("Send Edit Request"), " — Sends a link so the registrant can update their own responses."),
    li(b("Cancel Registration"), " — Cancels this registration (with confirmation)."),
    li(b("Restore Registration"), " — Brings back a cancelled registration."),
    li(b("Delete Record"), " — Permanently removes a cancelled registration. Cannot be undone."),
    sp(),
    p(b("Bulk reminders:"), " If you set a reminder date in the editor, you'll see a reminder section at the top of the page. It shows how many have been sent and how many remain. Click ", b("Send to Remaining"), " to send to everyone who hasn't received one yet. Click ", b("Show names"), " to preview who will receive it before you send."),
    sp(),

    h(2, "Common Situations"),
    sp(),
    p(b("A spot just opened and people are waitlisted")),
    p("You'll see the 'Spot opened' alert. Click the next person on the waitlist and click ", b("Promote to Registered"), ". They'll get a notification and be moved to confirmed."),
    sp(),
    p(b("Someone wants to change their registration answers")),
    p("Two options: expand their row and click ", b("Edit"), " in the Responses column to change it yourself, or click ", b("Send Edit Request"), " to send them a link so they can update it themselves."),
    sp(),
    p(b("A program is full")),
    p("Nothing to do — new registrations are automatically waitlisted. When you're ready to admit someone (someone cancelled, or you increased capacity), use the Promote button."),
    sp(),
    p(b("Sending reminders before a program starts")),
    p("Set a reminder date and message in the editor (Registration tab). When the date arrives, go to the registration page and click ", b("Send to Remaining"), ". You can also send to individuals by expanding a row."),
    sp(),
    p(b("I need to share the virtual session with non-members")),
    p("Enable ", b("Open Access"), " in the Schedule tab. After saving, a guest link will generate — copy it and share it. Anyone with the link can join without logging in. If the link gets shared too widely, reset it to generate a new one."),
    sp(),
    p(b("Someone can't afford the dana amount")),
    p("Dana is generosity-based — the system handles whatever amount they choose. If someone reaches out about cost, you can reassure them. If needed, adjust the dana step message in the editor."),
    sp(),

    h(2, "Managing Categories"),
    p("Categories do two jobs. Their name organizes programs into sections on the public Programs & Events page — each program belongs to one category. And each category has a Kind — what the offerings in it actually are: a Drop-In, a Community Group, a Class, an Event, a Retreat, a Service offering, or Private."),
    sp(),
    p("The Kind is what the system uses to decide where a program shows up. Drop-ins and open community groups appear on the community schedule and on members' home page as something anyone can simply join. Classes, events, and retreats are things people register for — they show up in a member's \"Coming up for you\" once that member has registered, and they never invite someone to join who hasn't signed up. So setting the right Kind is what keeps the home page honest about what's a drop-in and what needs a registration."),
    sp(),
    p("Assign a category to a program in the editor's Categories tab — pick from the dropdown."),
    sp(),
    p("To manage all categories — set each one's Kind, add, remove, or reorder — go to /tools/programs/categories. Each row has a Kind dropdown. The order you set there is the order categories appear on the public page. Programs without a category won't show up on the Programs & Events page."),
  ];

  if (existing) {
    await db.manualSection.update({
      where: { slug: "program-manager" },
      data: {
        title: "Program Manager",
        description: "How to create programs, manage registrations, send reminders, and handle common situations.",
        hubSlug: "registrar",
        body,
        relations: [],
      },
    });
    console.log("  ✔ Updated manual section: program-manager");
  } else {
    await db.manualSection.create({
      data: {
        slug: "program-manager",
        title: "Program Manager",
        description: "How to create programs, manage registrations, send reminders, and handle common situations.",
        hubSlug: "registrar",
        body,
        relations: [],
        order: 10,
      },
    });
    console.log("  ✔ Created manual section: program-manager");
  }
}
