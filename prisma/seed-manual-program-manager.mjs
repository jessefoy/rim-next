/**
 * seed-manual-program-manager.mjs — Creates the Program Manager manual section.
 *
 * Called from migrate.mjs. Upserts a ManualSection with BlockNote JSON body.
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
    p("The Program Manager is your main workspace for creating and managing programs. You can get to it two ways:"),
    li(b("From the Registrar Hub:"), " Open the sidebar and click ", b("Program Manager"), " under Tools."),
    li(b("Direct link:"), " Go to /tools/programs in your browser."),
    p("You'll see the program list as soon as it loads — a table of every program in the system."),
    sp(),

    h(2, "The Program List"),
    p("The list shows all your programs in a table with filter pills across the top:"),
    li(b("All"), " — Every active (non-archived) program."),
    li(b("Open"), " — Programs with registration currently open."),
    li(b("Has waitlist"), " — Programs where at least one person is waitlisted."),
    li(b("Needs attention"), " — Programs that need you to do something: people are waitlisted, dana payments are pending, or a spot opened up."),
    li(b("Archived"), " — Programs you've archived. They're hidden from everyone but still in the system."),
    sp(),
    p("Each row shows the program name, format (In-person/Virtual/Hybrid), registration status, capacity bar, and any flags. The capacity bar fills up as people register — it turns amber when it's getting close to full, and red when it's at capacity."),
    sp(),
    p("You can ", b("search"), " programs by name or tagline using the search box. To create a new program, click ", b("+ Add Program"), " in the top right."),
    sp(),
    p(b("Archiving and restoring:"), " Click ", b("Archive"), " on any active program to hide it from all public and member-facing views. You can restore it anytime from the Archived filter. Only admins can permanently delete programs, and only after they're archived and have no active registrations."),
    sp(),

    h(2, "Creating a Program"),
    p("Click ", b("+ Add Program"), " to open the editor. It has four tabs:"),
    sp(),
    p(b("Program tab"), " — The basics. Give it a name (the title everyone sees), and the slug will auto-generate. Add a tagline, description, image, pull quote, and assign teachers. Pick a category so it shows up on the public Programs & Events page."),
    sp(),
    p(b("Schedule & Registration tab"), " — When and where, plus who can sign up. Set the format, venue, start/end dates, and recurrence pattern. Then scroll down to the registration section: enable registration, set capacity, add custom questions, and write your confirmation and reminder messages."),
    sp(),
    p(b("Dana & Messages tab"), " — How donations work and what messages appear on dashboard cards. Choose a dana mode (None, Voluntary, Base + Dana, or Fixed), set amounts, and write the messaging. Below that, add any special announcements or early arrival messages."),
    sp(),
    p(b("Display tab"), " — Where this program shows up. Control sort order, hide from the public listing or member dashboards, and set which days of the week it meets (this drives the 'Today' badge on dashboards)."),
    sp(),
    p("When you're ready, click ", b("Save"), " at the bottom. For new programs, you'll be taken to the edit page. For existing programs, you'll see a 'Saved successfully' confirmation."),
    sp(),
    p(b("Important:"), " If you navigate away before saving, you'll see a warning. The editor protects you from losing your work."),
    sp(),

    h(2, "Editing a Program"),
    p("From the program list, click ", b("Edit"), " next to any program. You'll see the same four tabs, pre-filled with the current settings."),
    sp(),
    p("A few things to know about editing:"),
    li("The slug is locked by default. You can unlock it, but ", b("changing a slug after the program is live will break any existing links and host assignments"), ". Only do this if you're sure."),
    li("There's a ", b("View program page →"), " link at the top that opens the public program page in a new tab — handy for checking how your changes look."),
    li("Changes take effect after you save. The public page updates when Vercel deploys (usually about a minute)."),
    sp(),

    h(2, "Managing Registrations"),
    p("Click a program name in the list to open the registration detail page. This is where you manage the people who signed up."),
    sp(),
    p(b("The stat bar"), " at the top gives you a quick picture: how many confirmed, waitlisted, cancelled, and how many have pending dana. If the program has a capacity, you'll see a visual bar showing how full it is."),
    sp(),
    p(b("Spot opened alert:"), " If someone cancels and there's a waitlist, you'll see a notice: 'A spot has opened.' Use the Promote button to move the next waitlisted person to confirmed."),
    sp(),
    p(b("Filters and search:"), " Use the pills (All, Registered, Waitlisted, Cancelled) to narrow the list. Search by name or email. Export to CSV if you need a spreadsheet."),
    sp(),
    p("Click any row to expand it. You'll see three columns:"),
    li(b("Contact"), " — Name, email, phone, registration date."),
    li(b("Responses"), " — Answers to custom questions. Click Edit to change them if needed."),
    li(b("Actions & Notes"), " — Everything you can do with this registration, plus internal notes visible only to staff."),
    sp(),
    p(b("Actions you can take:"), ""),
    li(b("Promote to Registered"), " — Moves a waitlisted person to confirmed status."),
    li(b("Send Dana Reminder"), " — Sends an email nudging someone to complete their donation."),
    li(b("Send Reminder"), " — Sends the program reminder email to this person."),
    li(b("Resend Confirmation"), " — Re-sends the original registration confirmation email."),
    li(b("Send Edit Request"), " — Sends a link so the registrant can update their own responses."),
    li(b("Cancel Registration"), " — Cancels this registration (with confirmation)."),
    li(b("Restore Registration"), " — Brings back a cancelled registration."),
    li(b("Delete Record"), " — Permanently removes a cancelled registration (cannot be undone)."),
    sp(),
    p(b("Reminders:"), " If you set a reminder date in the program editor, you'll see a reminder section at the top of the registration page. It shows how many reminders have been sent and how many are remaining. Click ", b("Send to Remaining"), " to send to everyone who hasn't gotten one yet. Click ", b("Show names"), " to see exactly who will receive it before you send."),
    sp(),

    h(2, "Common Situations"),
    sp(),
    p(b("A spot just opened and people are waitlisted")),
    p("You'll see the 'Spot opened' alert at the top. Click the row of the next person on the waitlist (they're numbered #1, #2, etc.) and click ", b("Promote to Registered"), ". They'll get a notification and be moved to confirmed status. If the program has dana, their donation status will be set to Pending."),
    sp(),
    p(b("Someone wants to change their registration answers")),
    p("You have two options: expand their row and click ", b("Edit"), " in the Responses column to change it yourself, or click ", b("Send Edit Request"), " to send them a link so they can update their own answers."),
    sp(),
    p(b("A program is full — what do I do?")),
    p("Nothing! New registrations are automatically waitlisted. When you're ready to let someone in — either because someone else cancelled or you increased the capacity — use the Promote button."),
    sp(),
    p(b("Sending reminders before a program starts")),
    p("Set a reminder date and message in the program editor (Schedule & Registration tab). When the date arrives, go to the registration detail page and click ", b("Send to Remaining"), ". You can also send individual reminders by expanding a row and clicking Send Reminder."),
    sp(),
    p(b("Someone can't afford the dana amount")),
    p("You don't need to do anything technical. Dana is generosity-based — the system handles whatever amount they choose. If someone reaches out about cost, you can reassure them and adjust the dana step message in the editor if needed."),
    sp(),

    h(2, "Categories"),
    p("Categories organize programs on the public Programs & Events page. Each program can belong to one category."),
    sp(),
    p("To assign a category, go to the Program tab in the editor and pick one from the dropdown."),
    sp(),
    p("To manage categories (add, remove, or reorder), go to /tools/programs/categories. The order you set here is the order they appear on the public page. Programs without a category won't show up on the Programs & Events page (though they're still accessible by direct link)."),
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
