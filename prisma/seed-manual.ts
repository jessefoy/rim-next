/**
 * seed-manual.ts
 * Inserts ManualSection records for the core staff manual chapters.
 * Uses upsert on slug — safe to run multiple times.
 *
 * Run: set -a && source .env.local && set +a &&
 *      npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-manual.ts
 */

import { PrismaClient } from "@prisma/client";

// For local seeding use direct (non-pooling) URL
const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL,
    },
  },
});

function p(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function h2(text: string) {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}

function h3(text: string) {
  return { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text }] };
}

function ul(items: string[]) {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: item }] }],
    })),
  };
}

function ol(items: string[]) {
  return {
    type: "orderedList",
    content: items.map((item) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text: item }] }],
    })),
  };
}

function doc(...nodes: object[]) {
  return { type: "doc", content: nodes };
}

const sections = [
  {
    slug: "registration-management",
    title: "Registration Management",
    hubSlug: "registrar",
    order: 20,
    relations: ["programs-editor", "member-registry", "volunteer-roles"],
    body: doc(
      h2("What this is"),
      p("Registration is the process by which someone claims a spot in a program. This manual section covers the full registration system — what the experience looks like from a member's perspective, what your tools look like from the volunteer side, and how to handle every situation that comes up."),

      h2("How to use it"),
      p("Your workspace starts at /account/hub/registrar/programs. This page shows all programs that have registration enabled, in sort order."),
      p("Each program card shows the registration count, capacity, waitlist status, and a badge if anything needs attention — open spots, pending waitlist members, or pending dana."),
      p("Click any card to open the full registration table for that program. From the table you can:"),
      ul([
        "See all registrants: name, email, phone, status, dana status, amount paid, date registered, and any custom question responses",
        "Change a registrant's status — promote from waitlist, cancel a registration, restore a cancelled registration",
        "Edit a registrant's custom question responses directly in the table",
        "Send a self-service edit link to a registrant (they get an email with a secure link — no account required)",
        "Send an individual reminder email, or bulk-send to everyone who hasn't received one yet",
        "Send a dana reminder to a specific registrant with pending dana",
        "Resend a confirmation email to any registrant",
        "Add or edit a private note (visible only to volunteers — never sent to the member)",
        "Export the full list as a CSV file",
      ]),

      h2("Registration statuses"),
      p("Every registration has a status:"),
      ul([
        "Registered — confirmed spot, set automatically when they submit and capacity is available",
        "Approved — like Registered, but set manually by a volunteer (for application-based programs)",
        "Waitlisted — program was full when they registered; promote manually when a spot opens",
        "Cancelled — cancelled by member or by a registrar; does not count toward capacity; can be restored",
      ]),

      h2("Dana"),
      p("Dana is the traditional practice of giving. For programs that use dana, the registration form includes a payment step via Stripe."),
      p("Dana modes: None (no step), Voluntary (suggested amount, member can skip), Base + Dana (required base fee plus optional extra), Fixed (set price)."),
      p("Dana status in your table: Waived (not expected), Pending (expected but not completed), Completed (received), Not Required (person is on waitlist)."),

      h2("Automatic emails"),
      p("These emails go out automatically — you don't need to trigger them:"),
      ul([
        "When someone registers → confirmation email to registrant",
        "When you promote from waitlist → approval email to registrant",
        "When a registration is cancelled → notification to registrar inbox",
        "On the scheduled reminder date → reminder to all confirmed registrants",
        "When you send a self-service edit link → secure link email to registrant",
        "When a registrant uses their edit link → notification to registrar inbox",
        "When you send a dana reminder → gentle nudge to registrant with link",
      ]),

      h2("Course access from registration"),
      p("Some programs include access to online materials. When a program is linked to a course, anyone who registers automatically receives access. You don't need to do anything."),
      p("For historical members or exceptions, grant or revoke course access manually from the member detail page at /admin/members/[id] — scroll to the Course Access section."),

      h2("Common tasks"),
      ol([
        "To promote someone from the waitlist: open the program table, find their row, click Promote, confirm",
        "To cancel a registration: find their row, click Cancel, confirm",
        "To send a reminder: click Send Reminder on the individual row, or use the bulk Send Reminders button at the top",
        "To export: click the Export CSV button at the top of the table",
        "To add a note: click the note icon in the row, type your note, save",
      ])
    ),
  },

  {
    slug: "programs-editor",
    title: "Programs — Creating and Managing",
    hubSlug: "registrar",
    order: 21,
    relations: ["registration-management", "volunteer-roles"],
    body: doc(
      h2("What this is"),
      p("Programs are the events, courses, and gatherings that RIM offers to the community. This section explains how to create and manage programs using the Program Editor in the Registrar hub."),

      h2("Where to find it"),
      p("Program editing is available at /account/hub/registrar/programs. Admins and Registrars can create and edit programs. From any program card, click the settings icon or 'Edit Program' to open the editor."),

      h2("Program tabs"),
      p("The program editor is organized into six tabs:"),
      ul([
        "1. Basics — name, tagline, description, format (in-person/virtual), teacher, category",
        "2. When & Where — start/end datetime, location, recurrence settings, video conferencing (LiveKit)",
        "3. Registration — enable registration, capacity, custom questions, waitlist, deadline",
        "4. Emails — confirmation message, reminder date, reminder message",
        "5. Dana — dana mode (none/voluntary/base+dana/fixed) and amounts",
        "6. Settings — sort order, dashboard visibility, archive",
      ]),

      h2("Video Conferencing"),
      p("Virtual programs use LiveKit for embedded video conferencing (replacing Google Meet). Members join directly from the dashboard — no external links, no separate accounts. Host permissions are controlled by RIM's auth system via JWT tokens."),
      p("Important: Video sessions are accessible from the member dashboard only — not in emails, not on the public program page. Members must be logged in. This protects virtual sessions and is good stewardship of dana."),
      p("LiveKit integration status: Phase 1-2 complete (foundation + dashboard embed). Phase 3 (host controls) and Phase 4 (full Google Meet removal) are pending."),

      h2("Things to know"),
      ul([
        "Programs are stored in Postgres, not Sanity Studio",
        "Slug is permanent once registrations exist — do not change it after launch",
        "Archiving a program hides it from listings but preserves all registration data",
        "Registration-based course access: if you link a course to a program, new registrants get access automatically; existing registrants before the link was added do not — grant those manually",
      ])
    ),
  },

  {
    slug: "member-registry",
    title: "Member Accounts",
    hubSlug: null,
    order: 30,
    relations: ["registration-management", "volunteer-roles"],
    body: doc(
      h2("What this is"),
      p("The member registry is the list of everyone who has joined the RIM community — either by registering for a program or by signing in directly. It's available to Admins and Registrars at /admin/members."),

      h2("The member list"),
      p("The member list at /admin/members shows all active members. You can:"),
      ul([
        "Search by name or email",
        "Filter by role (Host, Teacher, Admin, etc.)",
        "Toggle to show archived members",
        "Import members via CSV",
      ]),

      h2("The member profile"),
      p("Click any member to open their profile at /admin/members/[id]. From the profile you can:"),
      ul([
        "View and edit their name, email, phone, address",
        "Set or change their preferred name",
        "Assign or remove roles (Host, Host Manager, Teacher, Support, Registrar, Admin)",
        "View their registration history",
        "Manage course access (grant or revoke individual courses)",
        "View hub access records",
        "Add or edit admin notes (internal only, never visible to the member)",
        "Manage household membership",
        "Archive or restore the account",
      ]),

      h2("Member status"),
      p("Every member has a status: Active (normal), Pending (incomplete onboarding), or Archived (soft-deleted). Archived members cannot log in and their data is preserved."),

      h2("Roles"),
      p("Roles control what a member can access in the staff areas. Assigning a role sends an automated welcome email. Removing a role sends a notification email and removes hub access automatically."),

      h2("Community membership philosophy"),
      p("RIM is an intentional community. Every User record with agreedToTerms = true is an intentional community member. The system is designed so people surface naturally through program registration — not bulk imports. Real names are required. Community agreements are accepted once, never again."),

      h2("Common tasks"),
      ol([
        "To find a member: go to /admin/members, search by name or email",
        "To assign a role: open member profile, check the role checkbox, save — an email goes out automatically",
        "To grant course access: open member profile, scroll to Course Access, click Grant Access",
        "To archive a member: open member profile, scroll to Danger Zone, click Archive",
      ])
    ),
  },

  {
    slug: "volunteer-roles",
    title: "Volunteer Roles",
    hubSlug: null,
    order: 40,
    relations: ["member-registry"],
    body: doc(
      h2("What this is"),
      p("Volunteer roles control what staff members can access in the RIM website backend. Each role unlocks a different hub and set of tools."),

      h2("Active roles"),
      ul([
        "HOST — access to the Host Community Hub; can be on the session hosting rotation",
        "HOST_MANAGER — manages the host schedule and assignments; full read/write access to the Host Hub; can also be on rotation (combinable with HOST)",
        "TEACHER — access to the Course Hub; can create and manage courses and lessons",
        "SUPPORT — access to the Support Inbox; can read, reply to, and manage support threads",
        "REGISTRAR — access to the Registrar hub; can manage programs, registrations, and members",
        "ADMIN — full access to everything; bypasses all hub membership checks",
      ]),

      h2("Assigning a role"),
      ol([
        "Go to /admin/members and open the member's profile",
        "Scroll to the Roles section",
        "Check the checkbox for the role you want to assign",
        "Click Save — a welcome email goes out automatically, and hub access is created",
      ]),

      h2("Notification email"),
      p("When a role is assigned, the member receives an email welcoming them to their new role and explaining what they have access to. The email is sent from hello@rootedinmindfulness.org. You can preview the email template at /admin/emails."),

      h2("Removing a role"),
      p("Unchecking a role and saving removes hub access automatically and sends a brief notification email to the member. Their account remains active — only the role is removed."),

      h2("Hub access summary"),
      ul([
        "HOST → host-team hub",
        "HOST_MANAGER → host-team hub (as coordinator)",
        "TEACHER → teacher hub (Course Hub / courses hub)",
        "SUPPORT → support hub",
        "REGISTRAR → registrar hub",
        "ADMIN → all hubs, no membership record required",
      ])
    ),
  },
];

async function main() {
  console.log("Seeding manual sections…");

  for (const section of sections) {
    const result = await db.manualSection.upsert({
      where: { slug: section.slug },
      create: {
        slug: section.slug,
        title: section.title,
        hubSlug: section.hubSlug,
        order: section.order,
        relations: section.relations,
        body: section.body,
      },
      update: {
        title: section.title,
        hubSlug: section.hubSlug,
        order: section.order,
        relations: section.relations,
        body: section.body,
      },
    });
    console.log(`  ✓ ${result.slug} — "${result.title}"`);
  }

  console.log("Done.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
