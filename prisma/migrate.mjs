/**
 * Lightweight migration runner for Vercel builds.
 *
 * Prisma's `migrate deploy` requires a baseline for existing databases.
 * This script runs migrations idempotently via Prisma's $executeRawUnsafe.
 */

import { PrismaClient } from "@prisma/client";
import { seedPrograms } from "./seed-programs.mjs";
import { seedManualProgramManager } from "./seed-manual-program-manager.mjs";
import { seedManualHostHubTeamManagement } from "./seed-manual-host-hub-team-management.mjs";
import { seedManualHostSchedule } from "./seed-manual-host-schedule.mjs";
import { seedHostHubHomeContent } from "./seed-host-hub-home-content.mjs";

const db = new PrismaClient();

const migrations = [
  {
    name: "add_tool_slug_to_hub_app_links",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'hub_app_links' AND column_name = 'toolSlug'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "hub_app_links" ADD COLUMN "toolSlug" TEXT`);
        await db.$executeRawUnsafe(`UPDATE "hub_app_links" SET "toolSlug" = 'schedule' WHERE "href" LIKE '%/tools/schedule%'`);
        await db.$executeRawUnsafe(`UPDATE "hub_app_links" SET "toolSlug" = 'inbox' WHERE "href" LIKE '%/tools/inbox%'`);
        await db.$executeRawUnsafe(`UPDATE "hub_app_links" SET "toolSlug" = 'programs' WHERE "href" LIKE '%/tools/programs%'`);
        await db.$executeRawUnsafe(`UPDATE "hub_app_links" SET "toolSlug" = 'learning' WHERE "href" LIKE '%/tools/learning%'`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "add_sort_order_to_program_categories",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'program_categories' AND column_name = 'sortOrder'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "program_categories" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "add_time_text_to_programs",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'programs' AND column_name = 'timeText'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN "timeText" TEXT`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "add_open_access_fields_to_programs",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'programs' AND column_name = 'isOpenAccess'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN "isOpenAccess" BOOLEAN NOT NULL DEFAULT false`);
        await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN "guestAccessKey" TEXT`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "add_dashboard_show_at_to_programs",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'programs' AND column_name = 'dashboardShowAt'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN "dashboardShowAt" TIMESTAMPTZ`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "change_dana_message_to_jsonb",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'programs' AND column_name = 'danaMessage' AND data_type = 'text'
      `);
      if (cols.length > 0) {
        // Null out existing plain-text values then convert column type to JSONB
        await db.$executeRawUnsafe(`UPDATE "programs" SET "danaMessage" = NULL`);
        await db.$executeRawUnsafe(`ALTER TABLE "programs" ALTER COLUMN "danaMessage" TYPE JSONB USING "danaMessage"::JSONB`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "create_program_teachers_table",
    async run() {
      const tables = await db.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'program_teachers'
      `);
      if (tables.length === 0) {
        await db.$executeRawUnsafe(`
          CREATE TABLE "program_teachers" (
            "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
            "programId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "order" INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT "program_teachers_pkey" PRIMARY KEY ("id"),
            CONSTRAINT "program_teachers_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE,
            CONSTRAINT "program_teachers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
            CONSTRAINT "program_teachers_programId_userId_key" UNIQUE ("programId", "userId")
          )
        `);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "add_hide_from_weekly_schedule",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'programs' AND column_name = 'hideFromWeeklySchedule'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN "hideFromWeeklySchedule" BOOLEAN NOT NULL DEFAULT false`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    name: "add_edited_to_hub_conversation_threads",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'hub_conversation_threads' AND column_name = 'edited'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "hub_conversation_threads" ADD COLUMN "edited" BOOLEAN NOT NULL DEFAULT false`);
        await db.$executeRawUnsafe(`ALTER TABLE "hub_conversation_threads" ADD COLUMN "editedAt" TIMESTAMP(3)`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    // Session-reflection module abandoned in session 89 (pre-launch). Dropping
    // all associated tables and enum; will be rebuilt from scratch if/when
    // attendance tracking is revisited. See RIM_Editor_Types.md rewrite notes.
    name: "drop_session_reflection_module",
    async run() {
      const tables = await db.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name IN ('session_attendance', 'session_reports', 'session_cohosts', 'session_cohost_reports')
      `);
      if (tables.length === 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "session_cohost_reports" CASCADE`);
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "session_cohosts" CASCADE`);
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "session_reports" CASCADE`);
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "session_attendance" CASCADE`);
      await db.$executeRawUnsafe(`DROP TYPE IF EXISTS "PostSessionAction"`);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Session 91 — fold Program.specialNotes into Program.description as an
    // Aside block. The specialNotes field was a separate top-level slot
    // rendered above the description; with the Aside block shipped in
    // session 90 (callout variant "aside"), authors can place the callout
    // inline inside the description itself. Migration preserves data by
    // wrapping each program's specialNotes (stored as BlockNote JSON, a
    // prose-only document from RimProseEditor) as the children of a new
    // Aside block and PREPENDING it to the description array. specialNotes
    // is then nulled. The schema field is kept for one release as a safety
    // net; removal will come in a later migration.
    name: "fold_special_notes_into_description_as_aside",
    async run() {
      // Guard: has the flag been recorded before?
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags" WHERE name = 'fold_special_notes_into_description_as_aside_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      // Pull every program that has a non-empty specialNotes value.
      const programs = await db.program.findMany({
        where: { specialNotes: { not: null } },
        select: { id: true, slug: true, description: true, specialNotes: true },
      });

      let migrated = 0;
      for (const p of programs) {
        const notesBlocks = Array.isArray(p.specialNotes) ? p.specialNotes : null;
        // Skip if the JSON doesn't look like BlockNote blocks (empty array,
        // null, or non-array shape). Null the field either way to clean up.
        if (!notesBlocks || notesBlocks.length === 0) {
          await db.program.update({
            where: { id: p.id },
            data: { specialNotes: null },
          });
          continue;
        }

        // Build an Aside block whose children are the existing notes blocks.
        // Each BlockNote block needs an id — BlockNote sets these on load,
        // but we need to pre-populate so Prisma stores a valid document.
        const { randomUUID } = await import("node:crypto");
        const asideBlock = {
          id: randomUUID(),
          type: "callout",
          props: { variant: "aside" },
          content: [],
          children: notesBlocks.map((b) => ({
            ...b,
            id: b?.id ?? randomUUID(),
          })),
        };

        const existingDescription = Array.isArray(p.description) ? p.description : [];
        const newDescription = [asideBlock, ...existingDescription];

        await db.program.update({
          where: { id: p.id },
          data: {
            description: newDescription,
            specialNotes: null,
          },
        });
        console.log(`    ↪ ${p.slug}: wrapped specialNotes as Aside, prepended to description`);
        migrated++;
      }

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('fold_special_notes_into_description_as_aside_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${migrated} programs migrated)`);
    },
  },
  {
    // Session 92 — Host Hub Rework Phase 1: add `bio` JSONB to users
    // (personal description, Message-type BlockNote).
    name: "add_user_bio",
    async run() {
      const bioCols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'bio'
      `);
      if (bioCols.length === 0) {
        await db.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN "bio" JSONB`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    // Session 92 revert — the role_profiles table was briefly introduced in
    // Phase 1 but is being dropped. Role descriptions live as coordinator-
    // authored Hub Home content instead.
    name: "drop_role_profiles",
    async run() {
      const tables = await db.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'role_profiles'
      `);
      if (tables.length > 0) {
        await db.$executeRawUnsafe(`DROP TABLE "role_profiles" CASCADE`);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    // Session 92 Phase 3 — Hub membership as authority for team state.
    // Adds HubMemberStatus enum + coordinator-owned fields on hub_members:
    //   status, hostingCapability, communicationsEnabled, pausedAt, pausedById,
    //   pauseNote, coordinatorNote. These decouple team state from system roles
    //   so coordinators can pause, restrict hosting, or silence notifications
    //   without touching the member's global Role[].
    name: "add_hub_member_authority_fields",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'hub_members' AND column_name = 'status'
      `);
      if (cols.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }
      // Enum
      await db.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "HubMemberStatus" AS ENUM ('ACTIVE', 'PAUSED', 'INACTIVE');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$
      `);
      // Columns
      await db.$executeRawUnsafe(`ALTER TABLE "hub_members" ADD COLUMN "status" "HubMemberStatus" NOT NULL DEFAULT 'ACTIVE'`);
      await db.$executeRawUnsafe(`ALTER TABLE "hub_members" ADD COLUMN "hostingCapability" BOOLEAN NOT NULL DEFAULT true`);
      await db.$executeRawUnsafe(`ALTER TABLE "hub_members" ADD COLUMN "communicationsEnabled" BOOLEAN NOT NULL DEFAULT true`);
      await db.$executeRawUnsafe(`ALTER TABLE "hub_members" ADD COLUMN "pausedAt" TIMESTAMP(3)`);
      await db.$executeRawUnsafe(`ALTER TABLE "hub_members" ADD COLUMN "pausedById" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE "hub_members" ADD COLUMN "pauseNote" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE "hub_members" ADD COLUMN "coordinatorNote" TEXT`);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Session 94 — Webflow Program Detail page: new programNotes field for
    // additional program context shown in the "Program Notes" section.
    // Separate from description (BlockNote) and specialAnnouncement (dashboard text).
    name: "add_program_notes_column",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'programs' AND column_name = 'programNotes'
      `);
      if (cols.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }
      await db.$executeRawUnsafe(`ALTER TABLE "programs" ADD COLUMN "programNotes" JSONB`);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Session 96 — EmailTemplate.textBody column. Optional plain-text body
    // for the templated-email engine. Improves deliverability (Gmail/Outlook
    // spam scoring favors multipart messages) and accessibility (screen
    // readers and text-only mail clients).
    name: "add_email_template_text_body",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'email_templates' AND column_name = 'textBody'
      `);
      if (cols.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }
      await db.$executeRawUnsafe(`ALTER TABLE "email_templates" ADD COLUMN "textBody" TEXT`);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Session 96 — Delete orphan email templates. These three were seeded
    // for the post-session reflection module (session 76) and the early
    // attendance-tracking flows. Both code paths were removed and the
    // templates have no callers in lib/email.ts.
    name: "delete_orphan_email_templates",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'delete_orphan_email_templates_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const result = await db.emailTemplate.deleteMany({
        where: {
          slug: { in: ["first-time-attendee", "returning-after-absence", "missing-report-alert"] },
        },
      });

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('delete_orphan_email_templates_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${result.count} orphan templates removed)`);
    },
  },
  {
    // Session 96 — Templates default to enabled:false (intentional safety
    // gate so seed installs don't immediately start sending). The five
    // production templates below are required for live RIM workflows;
    // only `missing-report-alert` stays disabled (the post-session
    // reflection module was retired in session 76).
    //
    // This migration is idempotent — flag prevents re-running, but it
    // will not re-disable a template that an admin has chosen to turn
    // off via the admin UI. It only enables; never disables.
    name: "enable_active_email_templates",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'enable_active_email_templates_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const slugs = [
        "host-role-assigned",
        "sub-request-posted",
        "sub-request-claimed",
        "session-reminder",
        "drip-lesson-available",
      ];

      const result = await db.emailTemplate.updateMany({
        where: { slug: { in: slugs } },
        data: { enabled: true },
      });

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('enable_active_email_templates_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${result.count} templates enabled)`);
    },
  },
  {
    // Session 96 — Migrate program/registration emails into the template
    // manager. Six templates: registration-confirmation, waitlist-approval,
    // registration-cancelled-internal, responses-updated-internal,
    // edit-request, dana-reminder. After this runs, all six are visible at
    // /admin/emails for preview/edit, and lib/email.ts uses sendTemplatedEmail
    // for them instead of hand-written HTML builders.
    name: "seed_program_registration_email_templates",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_program_registration_email_templates_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const templates = [
        {
          slug: "registration-confirmation",
          name: "Registration Confirmation",
          description: "Sent when a member registers for a program (confirmed or waitlisted).",
          enabled: true,
          subject: "{{#if isWaitlisted}}You're on the waitlist — {{programTitle}}{{else}}You're registered — {{programTitle}}{{/if}}",
          variables: ["firstName", "programTitle", "programUrl", "isWaitlisted", "waitlistPosition", "dateText", "locationText", "confirmationMessageHtml", "googleCalendarUrl", "icsUrl"],
          body: `Hi {{firstName}},

{{#if isWaitlisted}}
You're on the waitlist for **{{programTitle}}**.{{#if waitlistPosition}} You're currently **#{{waitlistPosition}}** in line.{{/if}}

If a spot opens up, we'll email you right away.
{{else}}
You're registered for **{{programTitle}}**. We look forward to practicing together.

{{#if dateText}}📅 {{dateText}}{{/if}}
{{#if locationText}}📍 {{locationText}}{{/if}}

{{#if confirmationMessageHtml}}
{{confirmationMessageHtml}}
{{/if}}

{{#if googleCalendarUrl}}
**Add to calendar:** [Google Calendar]({{googleCalendarUrl}}){{#if icsUrl}} · [Apple / Outlook (.ics)]({{icsUrl}}){{/if}}
{{/if}}
{{/if}}

**[View Program Details →]({{programUrl}})**

---
Rooted In Mindfulness · rootedinmindfulness.org`,
        },
        {
          slug: "waitlist-approval",
          name: "Waitlist Approval",
          description: "Sent when a registrar promotes a waitlisted member to confirmed.",
          enabled: true,
          subject: "Your spot is confirmed — {{programTitle}}",
          variables: ["firstName", "programTitle", "programUrl", "hasDana"],
          body: `## Your spot is confirmed

Hi {{firstName}},

Good news — a spot has opened up and you've been confirmed for **{{programTitle}}**. We look forward to practicing together.

**[View Program Details →]({{programUrl}})**

{{#if hasDana}}
---

This program includes a dana (generosity) practice. When you're ready, you can make your offering from the program page.

**[Complete Dana Offering →]({{programUrl}})**
{{/if}}

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
        },
        {
          slug: "registration-cancelled-internal",
          name: "Registration Cancelled (internal)",
          description: "Sent to the registrar when a registration is cancelled.",
          enabled: true,
          subject: "Registration cancelled — {{registrantName}} ({{programTitle}})",
          variables: ["registrantName", "registrantEmail", "programTitle", "volunteerUrl"],
          body: `## Registration Cancelled

A registration has been cancelled for **{{programTitle}}**.

> **Name:** {{registrantName}}
> **Email:** {{registrantEmail}}

If there are waitlisted members, you may want to offer the spot to the next person.

**[View Registrations →]({{volunteerUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
        {
          slug: "responses-updated-internal",
          name: "Responses Updated (internal)",
          description: "Sent to the registrar when a registrant submits their self-service response update.",
          enabled: true,
          subject: "{{registrantName}} updated their responses — {{programTitle}}",
          variables: ["registrantName", "programTitle", "volunteerUrl"],
          body: `## Responses Updated

**{{registrantName}}** has updated their registration responses for **{{programTitle}}**.

**[View Registration →]({{volunteerUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
        {
          slug: "edit-request",
          name: "Self-Service Edit Request",
          description: "Sent when a registrar invites a registrant to update their own responses. The link contains a single-use 7-day token.",
          enabled: true,
          subject: "Update your responses — {{programTitle}}",
          variables: ["firstName", "programTitle", "editUrl"],
          body: `## Update your responses

Hi {{firstName}},

Your registrar has invited you to review and update your registration responses for **{{programTitle}}**. Click below to open your pre-filled form.

**[Update My Responses →]({{editUrl}})**

This link is unique to you and expires in 7 days. It can only be used once.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
        },
        {
          slug: "dana-reminder",
          name: "Dana Reminder",
          description: "Gentle reminder sent to a member whose dana offering is still pending.",
          enabled: true,
          subject: "A gentle reminder — your dana for {{programTitle}}",
          variables: ["firstName", "programTitle", "registerUrl"],
          body: `## A gentle reminder

Hi {{firstName}},

Just a gentle note that your dana offering for **{{programTitle}}** is still pending. Whenever you feel moved to, you can complete it here:

**[Complete Your Dana Offering →]({{registerUrl}})**

*Dana is entirely optional — please only complete it if and when it feels right for you. Your participation is what matters most.*

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
        },
      ];

      let count = 0;
      for (const t of templates) {
        await db.emailTemplate.upsert({
          where: { slug: t.slug },
          update: { name: t.name, description: t.description, subject: t.subject, body: t.body, variables: t.variables, enabled: t.enabled },
          create: t,
        });
        count++;
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_program_registration_email_templates_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${count} templates upserted)`);
    },
  },
  {
    // Session 96 — Migrate hub-related emails into the template manager.
    // Four templates: registrar-role-assigned, hub-conv-new-thread,
    // hub-conv-new-reply, hub-welcome. After this runs, all four are
    // visible at /admin/emails for preview/edit.
    name: "seed_hub_email_templates",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_hub_email_templates_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const templates = [
        {
          slug: "registrar-role-assigned",
          name: "Registrar Role Assigned",
          description: "Sent to a member when they are granted the REGISTRAR role.",
          enabled: true,
          subject: "You've been added as a registrar — Rooted In Mindfulness",
          variables: ["firstName", "dashboardUrl", "manualUrl"],
          body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

You've been added as a **registrar** for Rooted In Mindfulness. This means you can now view and manage program registrations — approve and cancel spots, promote people from the waitlist, send reminders, and export attendee lists.

Two things to bookmark: your **Registrations dashboard** where you'll do your day-to-day work, and the **Staff Manual** — a plain-English guide to every part of the system. Start with the manual if anything is unclear.

**[Go to Registrations →]({{dashboardUrl}})**

**[Read the Staff Manual →]({{manualUrl}})**

If you have any questions, reply to this email or reach out directly. Welcome to the team.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
        },
        {
          slug: "hub-conv-new-thread",
          name: "Hub Conversation: New Thread",
          description: "Sent to hub coordinators when a new conversation thread is created.",
          enabled: true,
          subject: "New conversation in {{hubName}}: {{threadTitle}}",
          variables: ["firstName", "authorName", "hubName", "threadTitle", "threadUrl"],
          body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

**{{authorName}}** started a new conversation in {{hubName}}: *{{threadTitle}}*

**[Read Thread →]({{threadUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
        {
          slug: "hub-conv-new-reply",
          name: "Hub Conversation: New Reply",
          description: "Sent to thread participants when a new reply is posted.",
          enabled: true,
          subject: "New reply in {{hubName}}: {{threadTitle}}",
          variables: ["firstName", "replierName", "hubName", "threadTitle", "threadUrl"],
          body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

**{{replierName}}** replied to *{{threadTitle}}* in {{hubName}}.

**[Read Thread →]({{threadUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
        {
          slug: "hub-welcome",
          name: "Hub Welcome",
          description: "Sent when a member is added to a hub (by a coordinator or via syncHubMembership).",
          enabled: true,
          subject: "Welcome to {{hubName}}",
          variables: ["firstName", "hubName", "hubUrl"],
          body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

You've been added to **{{hubName}}**. This is a shared space for your team to stay connected, share updates, and coordinate together.

**[Visit {{hubName}} →]({{hubUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
      ];

      let count = 0;
      for (const t of templates) {
        await db.emailTemplate.upsert({
          where: { slug: t.slug },
          update: { name: t.name, description: t.description, subject: t.subject, body: t.body, variables: t.variables, enabled: t.enabled },
          create: t,
        });
        count++;
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_hub_email_templates_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${count} templates upserted)`);
    },
  },
  {
    // Session 96 — Migrate form-submission emails into the template manager.
    // Two templates: volunteer-interest-internal and kalyana-application-internal.
    // Both go to the team inbox (hello@rootedinmindfulness.org) when members
    // submit the corresponding public forms. Recipient address lives in
    // lib/email.ts (TEAM_EMAIL constant).
    name: "seed_form_submission_email_templates",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_form_submission_email_templates_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const templates = [
        {
          slug: "volunteer-interest-internal",
          name: "Volunteer Interest Submission (internal)",
          description: "Sent to the team inbox when a member submits the volunteer interest form at /volunteerism/volunteer.",
          enabled: true,
          subject: "New volunteer interest submission",
          variables: ["firstName", "lastName", "email", "phone", "interests"],
          body: `## New volunteer interest

> **Name:** {{firstName}} {{lastName}}
> **Email:** {{email}}{{#if phone}}
> **Phone:** {{phone}}{{/if}}

### Interests and talents

{{interests}}

---
Submitted via /volunteerism/volunteer`,
        },
        {
          slug: "kalyana-application-internal",
          name: "Kalyana Mitta Application (internal)",
          description: "Sent to the team inbox when a member applies to start a Kalyana Mitta group at /kalyana-mitta/kalyana-mitta-group-application.",
          enabled: true,
          subject: "New Kalyana Mitta Group Application",
          variables: ["firstName", "lastName", "email", "idea"],
          body: `## New Kalyana Mitta Group Application

> **Name:** {{firstName}} {{lastName}}
> **Email:** {{email}}

### Group idea

{{idea}}

---
Submitted via /kalyana-mitta/kalyana-mitta-group-application`,
        },
      ];

      let count = 0;
      for (const t of templates) {
        await db.emailTemplate.upsert({
          where: { slug: t.slug },
          update: { name: t.name, description: t.description, subject: t.subject, body: t.body, variables: t.variables, enabled: t.enabled },
          create: t,
        });
        count++;
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_form_submission_email_templates_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${count} templates upserted)`);
    },
  },
  {
    // Session 96 — Migrate support-notification email into the template
    // manager. One template covers all three event types (assigned, new
    // reply, new note); the message body is composed in lib/supportNotify.ts
    // before sending. Alert creation + 5-minute dedup logic stays where
    // it is.
    name: "seed_support_notification_email_template",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_support_notification_email_template_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      await db.emailTemplate.upsert({
        where: { slug: "support-notification" },
        update: {
          name: "Support Notification",
          description: "Sent to a support team member when a thread is assigned to them, gets a new reply, or gets a new internal note. Same email used for all three event types — alert-creation and dedup happen in lib/supportNotify.ts.",
          enabled: true,
          subject: "[RIM Support] {{threadSubject}}",
          variables: ["firstName", "message", "threadUrl"],
          body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

{{message}}

**[View this thread →]({{threadUrl}})**

---
Rooted In Mindfulness Support`,
        },
        create: {
          slug: "support-notification",
          name: "Support Notification",
          description: "Sent to a support team member when a thread is assigned to them, gets a new reply, or gets a new internal note. Same email used for all three event types — alert-creation and dedup happen in lib/supportNotify.ts.",
          enabled: true,
          subject: "[RIM Support] {{threadSubject}}",
          variables: ["firstName", "message", "threadUrl"],
          body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

{{message}}

**[View this thread →]({{threadUrl}})**

---
Rooted In Mindfulness Support`,
        },
      });

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_support_notification_email_template_v1')
      `);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Session 96 — Migrate magic-link emails into the template manager.
    // Two templates: magic-link-new-user and magic-link-returning. Both are
    // CRITICAL for authentication; sendMagicLinkEmail uses throwOnFailure
    // so a missing or disabled template surfaces an error to NextAuth
    // (which shows "Please try again" to the user) rather than silently
    // dropping the sign-in attempt.
    name: "seed_magic_link_email_templates",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_magic_link_email_templates_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const templates = [
        {
          slug: "magic-link-new-user",
          name: "Magic Link — New User",
          description: "⚠️ CRITICAL: required for sign-up. Sent by NextAuth when a first-time visitor enters their email. Disabling this template breaks new-account creation.",
          enabled: true,
          subject: "Welcome to Rooted In Mindfulness — your link to join",
          variables: ["url"],
          body: `## You're joining the community

We're glad you're here.

Click the button below to complete your account and step into the Rooted In Mindfulness community. This link is for you only and expires in 24 hours.

**[Complete my account →]({{url}})**

If you didn't request this link, you can safely ignore this email.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
        },
        {
          slug: "magic-link-returning",
          name: "Magic Link — Returning User",
          description: "⚠️ CRITICAL: required for sign-in. Sent by NextAuth when an existing member enters their email. Disabling this template breaks sign-in.",
          enabled: true,
          subject: "Your sign-in link — Rooted In Mindfulness",
          variables: ["url"],
          body: `## Your sign-in link

Click the button below to sign in to your account. This link expires in 24 hours.

**[Sign in →]({{url}})**

If you didn't request this link, you can safely ignore this email.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
        },
      ];

      let count = 0;
      for (const t of templates) {
        await db.emailTemplate.upsert({
          where: { slug: t.slug },
          update: { name: t.name, description: t.description, subject: t.subject, body: t.body, variables: t.variables, enabled: t.enabled },
          create: t,
        });
        count++;
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_magic_link_email_templates_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${count} templates upserted)`);
    },
  },
  {
    // Session 96 — Organize email templates into groups in /admin/emails,
    // and add helpText warnings to the auth-critical and support-team
    // templates so admins understand the consequences of changes.
    //
    // Group keys are numerically prefixed (01-auth, 02-registrations, …)
    // to control display order; the EmailTemplate index page sorts by
    // `group` ascending. The user-visible label is `groupLabel`.
    //
    // helpText is rendered above the subject line in the per-template
    // editor — visible whenever an admin opens a template to edit.
    name: "organize_email_templates_with_groups_and_helptext",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'organize_email_templates_with_groups_and_helptext_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      // Centralized mapping. Each entry: { slug, group, groupLabel, helpText? }
      const ORG = [
        // ─── 01 · Sign-in & Authentication (CRITICAL) ───────────────────
        {
          slug: "magic-link-new-user",
          group: "01-auth",
          groupLabel: "Sign-in & Authentication",
          helpText:
            "⚠️ CRITICAL — required for new-account sign-up.\n\n" +
            "Sent automatically by NextAuth when a first-time visitor enters their email address. If this template is disabled, OR if the {{url}} variable is removed from the body, sign-up breaks immediately for everyone — new visitors can't complete account creation.\n\n" +
            "SAFE to edit: subject line, greeting, body copy, link/button label.\n\n" +
            "DO NOT: disable the \"Enabled\" toggle, remove or rename {{url}}, or remove the link/button entirely.\n\n" +
            "If sign-up appears broken: confirm this template is Enabled and the body still contains {{url}}.",
        },
        {
          slug: "magic-link-returning",
          group: "01-auth",
          groupLabel: "Sign-in & Authentication",
          helpText:
            "⚠️ CRITICAL — required for member sign-in.\n\n" +
            "Sent automatically by NextAuth when an existing member enters their email address. If this template is disabled, OR if the {{url}} variable is removed from the body, sign-in breaks immediately for everyone — members can't access their accounts.\n\n" +
            "SAFE to edit: subject line, greeting, body copy, link/button label.\n\n" +
            "DO NOT: disable the \"Enabled\" toggle, remove or rename {{url}}, or remove the link/button entirely.\n\n" +
            "If sign-in appears broken: confirm this template is Enabled and the body still contains {{url}}.",
        },

        // ─── 02 · Registrations ─────────────────────────────────────────
        { slug: "registration-confirmation",        group: "02-registrations", groupLabel: "Registrations" },
        { slug: "waitlist-approval",                group: "02-registrations", groupLabel: "Registrations" },
        { slug: "edit-request",                     group: "02-registrations", groupLabel: "Registrations" },
        { slug: "dana-reminder",                    group: "02-registrations", groupLabel: "Registrations" },
        { slug: "registration-cancelled-internal",  group: "02-registrations", groupLabel: "Registrations" },
        { slug: "responses-updated-internal",       group: "02-registrations", groupLabel: "Registrations" },

        // ─── 03 · Session Reminders ─────────────────────────────────────
        { slug: "session-reminder",                 group: "03-sessions",      groupLabel: "Session Reminders" },

        // ─── 04 · Host Team ─────────────────────────────────────────────
        { slug: "host-role-assigned",               group: "04-hosts",         groupLabel: "Host Team" },
        { slug: "sub-request-posted",               group: "04-hosts",         groupLabel: "Host Team" },
        { slug: "sub-request-claimed",              group: "04-hosts",         groupLabel: "Host Team" },

        // ─── 05 · Hubs & Onboarding ─────────────────────────────────────
        { slug: "registrar-role-assigned",          group: "05-hubs",          groupLabel: "Hubs & Onboarding" },
        { slug: "hub-welcome",                      group: "05-hubs",          groupLabel: "Hubs & Onboarding" },
        { slug: "hub-conv-new-thread",              group: "05-hubs",          groupLabel: "Hubs & Onboarding" },
        { slug: "hub-conv-new-reply",               group: "05-hubs",          groupLabel: "Hubs & Onboarding" },

        // ─── 06 · Support Inbox (IMPORTANT) ─────────────────────────────
        {
          slug: "support-notification",
          group: "06-support",
          groupLabel: "Support Inbox",
          helpText:
            "Important — keeps the support team in the loop.\n\n" +
            "Sent to a support team member when a thread has activity: thread assigned to them, a new reply from a member, or a new internal note from a teammate. The same template is used for all three event types — the {{message}} variable carries the event-specific text, built in lib/supportNotify.ts.\n\n" +
            "If disabled, the support team will still see in-app alerts at /tools/inbox, but they won't receive email notifications. Most people rely on email to know when there's a new reply, so disabling will likely slow response times.\n\n" +
            "The {{message}} variable contains text like \"New reply from Sarah on 'Question about registration'\" — it's required for the email to make sense. Don't remove it.",
        },

        // ─── 07 · Public Forms ──────────────────────────────────────────
        { slug: "volunteer-interest-internal",      group: "07-forms",         groupLabel: "Public Forms" },
        { slug: "kalyana-application-internal",     group: "07-forms",         groupLabel: "Public Forms" },

        // ─── 08 · Courses ───────────────────────────────────────────────
        { slug: "drip-lesson-available",            group: "08-courses",       groupLabel: "Courses" },
      ];

      let count = 0;
      for (const entry of ORG) {
        const data = {
          group: entry.group,
          groupLabel: entry.groupLabel,
          ...(entry.helpText !== undefined ? { helpText: entry.helpText } : {}),
        };
        // Use updateMany so missing slugs are silently skipped (won't error
        // if a template isn't present in this environment for any reason).
        const result = await db.emailTemplate.updateMany({
          where: { slug: entry.slug },
          data,
        });
        count += result.count;
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('organize_email_templates_with_groups_and_helptext_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${count} templates organized)`);
    },
  },
  {
    // Session 96 — Schedule tool rebuild: sub-request emails carry a
    // {{coverUrl}} deep link that opens the schedule page with the cover
    // confirmation modal pre-opened. The DB-stored email template needs
    // the new variable + a "Cover this session →" button. Idempotent:
    // upserts and records a flag so it only runs once per environment.
    name: "update_sub_request_posted_template_with_cover_url",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'update_sub_request_posted_template_with_cover_url_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const newVariables = ["firstName", "requesterName", "programName", "sessionDate", "message", "hubUrl", "coverUrl"];
      const newBody = `Hi {{firstName}},

**{{requesterName}}** needs a sub for **{{programName}}**{{sessionDate}}.

{{message}}

**[Cover this session →]({{coverUrl}})**

Or [view the full schedule]({{hubUrl}}) to see other ways to help.

---
Rooted In Mindfulness · rootedinmindfulness.org`;

      await db.emailTemplate.upsert({
        where: { slug: "sub-request-posted" },
        update: { variables: newVariables, body: newBody },
        create: {
          slug: "sub-request-posted",
          name: "Sub Request Posted",
          description: "Sent to all hosts when a host posts a sub request.",
          subject: "Sub needed: {{programName}}{{sessionDate}}",
          variables: newVariables,
          body: newBody,
        },
      });

      // Ensure flag table exists, then record this migration's flag.
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('update_sub_request_posted_template_with_cover_url_v1')
      `);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
];

async function main() {
  console.log("Running migrations...");
  for (const m of migrations) {
    await m.run();
  }

  // One-time program seed — check flag to avoid re-running
  const seedFlag = await db.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = '_migration_flags' AND column_name = 'seed_programs_v9'
  `).catch(() => []);

  // Create flag table if missing, then check
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
  `).catch(() => {});

  const applied = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_programs_v9'
  `).catch(() => []);

  if (applied.length === 0) {
    await seedPrograms(db);
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_programs_v9')`);
    console.log("  ✔ Program seed applied.");
  } else {
    console.log("  ⏭ Program seed already applied.");
  }

  // Program Manager manual section — always upsert (idempotent)
  const manualFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_manual_program_manager_v3'
  `).catch(() => []);

  if (manualFlag.length === 0) {
    await seedManualProgramManager(db);
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_manual_program_manager_v3')`);
  } else {
    console.log("  ⏭ Program Manager manual already seeded.");
  }

  // Host Hub Team Management manual section — idempotent via flag
  const hostHubManualFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_manual_host_hub_team_management_v1'
  `).catch(() => []);

  if (hostHubManualFlag.length === 0) {
    await seedManualHostHubTeamManagement(db);
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_manual_host_hub_team_management_v1')`);
  } else {
    console.log("  ⏭ Host Hub Team Management manual already seeded.");
  }

  // Host Hub home content (welcomeBody + homeContent) — idempotent via flag
  const hostHubHomeFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_host_hub_home_content_v1'
  `).catch(() => []);

  if (hostHubHomeFlag.length === 0) {
    await seedHostHubHomeContent(db);
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_host_hub_home_content_v1')`);
  } else {
    console.log("  ⏭ Host Hub home content already seeded.");
  }

  // Host Schedule manual section — written for the average host volunteer.
  // Seeds the new section AND bumps the order on the two sections that
  // would otherwise collide with order=7. Idempotent via flag.
  const hostScheduleManualFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_manual_host_schedule_v1'
  `).catch(() => []);

  if (hostScheduleManualFlag.length === 0) {
    await seedManualHostSchedule(db);
    // Push down the sections that previously occupied 7/8 to make room.
    // updateMany is a no-op when the rows are already at the target order.
    await db.manualSection.updateMany({ where: { slug: "support-inbox" },    data: { order: 8 } });
    await db.manualSection.updateMany({ where: { slug: "volunteer-roles" },  data: { order: 9 } });
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_manual_host_schedule_v1')`);
  } else {
    console.log("  ⏭ Host Schedule manual already seeded.");
  }

  await db.$disconnect();
  console.log("Migrations complete.");
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await db.$disconnect();
  process.exit(1);
});
