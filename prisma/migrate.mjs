/**
 * Lightweight migration runner for Vercel builds.
 *
 * Prisma's `migrate deploy` requires a baseline for existing databases.
 * This script runs migrations idempotently via Prisma's $executeRawUnsafe.
 */

import { PrismaClient } from "@prisma/client";
import { del } from "@vercel/blob";
import { seedPrograms } from "./seed-programs.mjs";
import { seedHostHubHomeContent } from "./seed-host-hub-home-content.mjs";
import { seedHostHubOnboardingDocs } from "./seed-host-hub-onboarding-docs.mjs";
import { seedHostHubTeamDocs } from "./seed-host-hub-team-docs.mjs";
import { updateHostHubWelcomeBody } from "./update-host-hub-welcome-body.mjs";
import { seedHostHubTrainingDoc } from "./seed-host-hub-training-doc.mjs";
import { seedNonHostHubHomeContent } from "./seed-non-host-hub-home-content.mjs";

const db = new PrismaClient();

const migrations = [
  // NOTE: the Program.useZoom column drop is deliberately NOT here. Session 159
  // removed every read of useZoom + dropped it from schema.prisma, but the
  // physical DROP COLUMN is deferred to a follow-up deploy (backlog 2026-06-25-004):
  // migrate.mjs runs during the build against the shared prod DB, so dropping it
  // in the cutover deploy would briefly break the still-live old code that selects
  // it. Prisma ignores the extra column, so leaving it costs nothing.
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
    // Session 134 cleanup — drop the AppSetting key-value table. It was the
    // Support Inbox's settings store (default assignee, sync historyId, manual-
    // sync rate-limit timestamps). The Support Inbox was removed in session 100
    // and nothing has referenced app_settings since. Removing the dead model
    // (schema.prisma) + the orphaned table here.
    name: "drop_app_settings_table",
    async run() {
      const tables = await db.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'app_settings' AND table_schema = 'public'
      `);
      if (tables.length === 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "app_settings" CASCADE`);
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
    // Session 96 — New "new-program-needs-host" email template. Sent to
    // active host-team members when a virtual/hybrid program is created,
    // so the team and the coordinator know about new sessions that may
    // need host coverage.
    name: "seed_new_program_needs_host_template",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_new_program_needs_host_template_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      await db.emailTemplate.upsert({
        where: { slug: "new-program-needs-host" },
        update: {
          name: "New Program Needs a Host",
          description: "Sent to active host-team members when a new virtual or hybrid program is created. Heads-up that a new program may need host coverage on its upcoming sessions.",
          enabled: true,
          group: "04-hosts",
          groupLabel: "Host Team",
          subject: "New program added: {{programName}}",
          variables: ["firstName", "programName", "programFormat", "scheduleUrl"],
          body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

A new program has just been added: **{{programName}}** ({{programFormat}}).

If you'd like to host one of its upcoming sessions, you can take it from the Host Schedule.

**[View the schedule →]({{scheduleUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
        create: {
          slug: "new-program-needs-host",
          name: "New Program Needs a Host",
          description: "Sent to active host-team members when a new virtual or hybrid program is created. Heads-up that a new program may need host coverage on its upcoming sessions.",
          enabled: true,
          group: "04-hosts",
          groupLabel: "Host Team",
          subject: "New program added: {{programName}}",
          variables: ["firstName", "programName", "programFormat", "scheduleUrl"],
          body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

A new program has just been added: **{{programName}}** ({{programFormat}}).

If you'd like to host one of its upcoming sessions, you can take it from the Host Schedule.

**[View the schedule →]({{scheduleUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
      });

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_new_program_needs_host_template_v1')
      `);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Session 96 — Sangha-friendly conversation categories for the host-team
    // hub. Replaces the schema default ["General"] with a set that fits the
    // kinds of conversation a hosting community has: questions, practice
    // insights from sessions, difficulties (asking for support), tips, and
    // coordinator announcements.
    //
    // Only updates if the hub currently has the exact default ["General"] —
    // preserves any customization a coordinator has already made.
    //
    // Other hubs keep their own categories. This is hub-specific seeding;
    // the conversations feature itself is hub-agnostic.
    name: "seed_host_team_conversation_categories",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_host_team_conversation_categories_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const hub = await db.hub.findUnique({
        where: { slug: "host-team" },
        select: { id: true, conversationCategories: true },
      });
      if (!hub) {
        console.log(`  ⏭ host-team hub not found — skipping`);
      } else {
        const current = hub.conversationCategories ?? [];
        const isDefault = current.length === 1 && current[0] === "General";
        if (isDefault) {
          await db.hub.update({
            where: { id: hub.id },
            data: {
              conversationCategories: [
                "Question",
                "Practice insight",
                "Difficulty",
                "Tip",
                "Announcement",
              ],
            },
          });
          console.log(`  ✔ Updated host-team conversation categories`);
        } else {
          console.log(`  ⏭ host-team hub already has custom categories — preserving`);
        }
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_host_team_conversation_categories_v1')
      `);
      console.log(`  ✔ Applied: ${this.name}`);
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
  {
    // One-time conversion of Hub.welcomeBody and Hub.homeContent from
    // BlockNote JSON arrays to plain HTML strings (new Tiptap storage format).
    // Idempotent: rows already holding HTML strings (typeof === "string") are skipped.
    // Rows with null/undefined are left as null.
    name: "convert_hub_content_to_html",
    async run() {
      const hubs = await db.hub.findMany({
        select: { id: true, welcomeBody: true, homeContent: true },
      });

      let converted = 0;

      for (const hub of hubs) {
        const updates = {};
        if (isBlockNoteArray(hub.welcomeBody)) {
          updates.welcomeBody = blockNoteToHtml(hub.welcomeBody);
          converted++;
        }
        if (isBlockNoteArray(hub.homeContent)) {
          updates.homeContent = blockNoteToHtml(hub.homeContent);
          converted++;
        }
        if (Object.keys(updates).length > 0) {
          await db.hub.update({ where: { id: hub.id }, data: updates });
        }
      }

      if (converted > 0) {
        console.log(`  ✔ Applied: ${this.name} — converted ${converted} field(s) across ${hubs.length} hub(s)`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    // Convert HubConversationThread.body and HubConversationReply.body from
    // BlockNote JSON arrays to plain HTML strings (new Tiptap storage format).
    // Idempotent: rows already holding HTML strings are skipped.
    name: "convert_conversation_body_to_html",
    async run() {
      const [threads, replies] = await Promise.all([
        db.hubConversationThread.findMany({ select: { id: true, body: true } }),
        db.hubConversationReply.findMany({ select: { id: true, body: true } }),
      ]);

      let converted = 0;

      for (const t of threads) {
        if (isBlockNoteArray(t.body)) {
          await db.hubConversationThread.update({
            where: { id: t.id },
            data: { body: blockNoteToHtml(t.body) },
          });
          converted++;
        }
      }

      for (const r of replies) {
        if (isBlockNoteArray(r.body)) {
          await db.hubConversationReply.update({
            where: { id: r.id },
            data: { body: blockNoteToHtml(r.body) },
          });
          converted++;
        }
      }

      if (converted > 0) {
        console.log(`  ✔ Applied: ${this.name} — converted ${converted} row(s)`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    // Backfill StandingAssignment.dayOfWeek for v2 rows that were saved before
    // the column existed. Single-day programs: copy from recurrenceDays[0].
    // Multi-day programs: leave null (the editor never produces multi-day rows
    // without dayOfWeek — only the v2 form did, and only briefly).
    // Idempotent: only updates rows where dayOfWeek IS NULL.
    name: "backfill_standing_assignment_day_of_week",
    async run() {
      // Ensure flag table exists
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `);
      const flagged = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags" WHERE name = '${this.name}_v1'
      `);
      if (Array.isArray(flagged) && flagged.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const rows = await db.standingAssignment.findMany({
        where: { dayOfWeek: null },
        select: { id: true, programSlug: true },
      });

      if (rows.length === 0) {
        await db.$executeRawUnsafe(`
          INSERT INTO "_migration_flags" (name) VALUES ('${this.name}_v1')
          ON CONFLICT DO NOTHING
        `);
        console.log(`  ✔ Applied: ${this.name} — no rows needed backfill`);
        return;
      }

      const slugs = [...new Set(rows.map((r) => r.programSlug))];
      const programs = await db.program.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true, recurrenceDays: true },
      });
      const daysBySlug = new Map(programs.map((p) => [p.slug, p.recurrenceDays ?? []]));

      let updated = 0;
      for (const r of rows) {
        const days = daysBySlug.get(r.programSlug) ?? [];
        if (days.length === 1) {
          await db.standingAssignment.update({
            where: { id: r.id },
            data:  { dayOfWeek: days[0] },
          });
          updated++;
        }
      }

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('${this.name}_v1')
        ON CONFLICT DO NOTHING
      `);
      console.log(`  ✔ Applied: ${this.name} — backfilled ${updated} of ${rows.length} row(s)`);
    },
  },
  {
    // Any StandingAssignment rows still with dayOfWeek=null after the backfill
    // are multi-day programs where we couldn't infer a single day. v3 requires
    // dayOfWeek; the apply logic now skips null rows so they don't fire on
    // every weekday. End them in the data too so they're consistent and
    // coordinators can re-create them via the editor with proper dayOfWeek.
    name: "end_legacy_null_day_of_week_rotations",
    async run() {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `);
      const flagged = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags" WHERE name = '${this.name}_v1'
      `);
      if (Array.isArray(flagged) && flagged.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const now = new Date();
      const result = await db.standingAssignment.updateMany({
        where: {
          dayOfWeek: null,
          OR: [{ endsOn: null }, { endsOn: { gte: now } }],
        },
        data: { endsOn: now },
      });

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('${this.name}_v1')
        ON CONFLICT DO NOTHING
      `);
      console.log(`  ✔ Applied: ${this.name} — ended ${result.count} legacy null-dayOfWeek row(s)`);
    },
  },
  {
    /**
     * Re-cache program.dateText / program.timeText from their source fields.
     *
     * These are now server-computed on every save (POST/PUT), but pre-existing
     * rows may have stale values from when the field accepted manual overrides.
     * This entry walks all programs every deploy — cheap because it only
     * writes when the stored value disagrees with the freshly computed one.
     */
    name: "recache_program_date_time_text",
    async run() {
      const programs = await db.program.findMany({
        select: {
          id: true,
          dateText: true,
          timeText: true,
          startDatetime: true,
          endDatetime: true,
          recurrenceFreq: true,
          recurrenceDays: true,
          recurrenceInterval: true,
        },
      });

      let updated = 0;
      for (const p of programs) {
        const dateText = computeDateText(
          p.startDatetime,
          p.recurrenceFreq,
          p.recurrenceDays,
          p.recurrenceInterval,
          p.endDatetime,
        ) || null;
        const timeText = computeTimeText(p.startDatetime, p.endDatetime) || null;

        if (dateText !== p.dateText || timeText !== p.timeText) {
          await db.program.update({
            where: { id: p.id },
            data: { dateText, timeText },
          });
          updated += 1;
        }
      }

      if (updated > 0) {
        console.log(`  ✔ Applied: ${this.name} — refreshed ${updated} program(s)`);
      } else {
        console.log(`  ⏭ ${this.name} — all programs already current`);
      }
    },
  },
  {
    // Session 113 — Hub document notifications.
    // Creates hub_document_notifications table (event log: who was notified,
    // when, and whether it was a creation or update event).
    // Also adds PDF to the HubDocumentFileType enum for uploaded file support.
    name: "create_hub_document_notifications",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'create_hub_document_notifications_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      // Add PDF to HubDocumentFileType enum (IF NOT EXISTS not valid for enum values;
      // catch the "already exists" error gracefully)
      await db.$executeRawUnsafe(
        `ALTER TYPE "HubDocumentFileType" ADD VALUE IF NOT EXISTS 'PDF'`
      ).catch(() => {});

      // Create hub_document_notifications table
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "hub_document_notifications" (
          "id"         TEXT        NOT NULL PRIMARY KEY,
          "documentId" TEXT        NOT NULL REFERENCES "hub_documents"("id") ON DELETE CASCADE,
          "userId"     TEXT        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "notifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "eventType"  TEXT        NOT NULL DEFAULT 'created'
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "hub_document_notifications_documentId_idx"
          ON "hub_document_notifications"("documentId")
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "hub_document_notifications_documentId_userId_idx"
          ON "hub_document_notifications"("documentId", "userId")
      `);

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('create_hub_document_notifications_v1')
      `);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Session 113 — Seed hub document notification email templates.
    // hub-document-created: someone added a document to the hub.
    // hub-document-updated: someone edited an existing document.
    name: "seed_hub_document_email_templates",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_hub_document_email_templates_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const templates = [
        {
          slug: "hub-document-created",
          name: "Hub Document: Added",
          description: "Sent to hub members chosen by the author when a new document is added.",
          enabled: true,
          group: "05-hubs",
          groupLabel: "Hubs & Onboarding",
          subject: "New document in {{hubName}}: {{docLabel}}",
          variables: ["firstName", "authorName", "hubName", "docLabel", "docUrl"],
          body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

**{{authorName}}** added a new document to {{hubName}}: *{{docLabel}}*

**[View document →]({{docUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
        {
          slug: "hub-document-updated",
          name: "Hub Document: Updated",
          description: "Sent to hub members chosen by the author when an existing document is updated.",
          enabled: true,
          group: "05-hubs",
          groupLabel: "Hubs & Onboarding",
          subject: "Document updated in {{hubName}}: {{docLabel}}",
          variables: ["firstName", "authorName", "hubName", "docLabel", "docUrl"],
          body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

**{{authorName}}** updated *{{docLabel}}* in {{hubName}}.

**[View document →]({{docUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
      ];

      for (const t of templates) {
        await db.emailTemplate.upsert({
          where:  { slug: t.slug },
          update: { name: t.name, description: t.description, subject: t.subject, body: t.body, variables: t.variables, enabled: t.enabled, group: t.group, groupLabel: t.groupLabel },
          create: t,
        });
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_hub_document_email_templates_v1')
      `);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Session 113 — Backfill seed entries for four templates that were
    // referenced by sendTemplatedEmail() in lib/email.ts but never seeded
    // by migrate.mjs. The organize-by-group migration earlier (session 96)
    // used updateMany() to assign group/groupLabel, which silently skipped
    // these slugs — so any environment without manually-created rows had
    // them silently no-op'ing in production.
    //
    // Defensive contract: `update: {}` is empty so any row Jesse has
    // already edited in /admin/emails is preserved. This migration ONLY
    // creates the row if it doesn't exist; it never overwrites existing
    // content. Re-running is a no-op.
    name: "backfill_missing_email_template_seeds",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'backfill_missing_email_template_seeds_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const templates = [
        {
          slug: "session-reminder",
          name: "Session Reminder",
          description: "Sent to a registrant as a reminder about an upcoming program session.",
          enabled: true,
          group: "03-sessions",
          groupLabel: "Session Reminders",
          subject: "Reminder: {{programTitle}}",
          variables: ["firstName", "programTitle", "dateText", "locationText", "reminderMessage", "dashboardUrl"],
          body: `Hi {{firstName}},

A gentle reminder that **{{programTitle}}** is coming up{{#if dateText}} — {{dateText}}{{/if}}.

{{#if locationText}}📍 {{locationText}}{{/if}}

{{#if reminderMessage}}
{{reminderMessage}}
{{/if}}

**[View in your dashboard →]({{dashboardUrl}})**

We look forward to practicing together.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
        },
        {
          slug: "host-role-assigned",
          name: "Host Role Assigned",
          description: "Sent to a member when they are granted the HOST role.",
          enabled: true,
          group: "04-hosts",
          groupLabel: "Host Team",
          subject: "Welcome to the host team — Rooted In Mindfulness",
          variables: ["firstName", "hostAreaUrl", "manualUrl"],
          body: `Hi {{firstName}},

You've been added to the **host team** at Rooted In Mindfulness. Thank you for offering this generosity to the sangha.

As a host, you'll help open and steward virtual sessions: greeting people as they arrive, holding space during practice, and being a calm presence when small things come up.

**[Open the Host Hub →]({{hostAreaUrl}})**

The Host Hub is your team's home — conversations, documents, the schedule, and everyone else on the team. If anything is unclear, the **[Staff Manual]({{manualUrl}})** has chapters on the host role and the schedule tool.

Welcome aboard.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
        },
        {
          slug: "sub-request-claimed",
          name: "Sub Request Claimed",
          description: "Sent to the host who requested coverage when another host claims the session.",
          enabled: true,
          group: "04-hosts",
          groupLabel: "Host Team",
          subject: "Your session is covered — {{programName}}",
          variables: ["firstName", "claimerName", "programName", "sessionDate", "message", "hubUrl"],
          body: `Hi {{firstName}},

Good news — **{{claimerName}}** has agreed to cover your hosting session for **{{programName}}**{{sessionDate}}.

{{#if message}}
> {{message}}
{{/if}}

You're off the hook for this one. Thank you for letting the team know early.

**[View the schedule →]({{hubUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
        {
          slug: "drip-lesson-available",
          name: "Drip Lesson Available",
          description: "Sent to a course member when a scheduled lesson becomes available on their drip-release schedule.",
          enabled: true,
          group: "08-courses",
          groupLabel: "Courses",
          subject: "New lesson available: {{lessonTitle}}",
          variables: ["memberFirstName", "lessonTitle", "seriesTitle", "lessonUrl"],
          body: `Hi {{memberFirstName}},

A new lesson is ready for you in **{{seriesTitle}}**:

## {{lessonTitle}}

**[Open the lesson →]({{lessonUrl}})**

Take your time with it. There's no rush — the lesson will be there whenever you're ready.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
        },
      ];

      let created = 0;
      let skipped = 0;
      for (const t of templates) {
        const existing = await db.emailTemplate.findUnique({ where: { slug: t.slug } });
        if (existing) {
          skipped++;
          continue;
        }
        await db.emailTemplate.create({ data: t });
        created++;
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('backfill_missing_email_template_seeds_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${created} created, ${skipped} preserved)`);
    },
  },
  {
    // Session 113 — Basecamp-style thread subscriptions for hub conversations.
    // Replaces the implicit "notify coordinators on new thread / notify
    // participants on reply" behavior with an explicit subscriber list.
    //
    // Backfill: for every existing thread, subscribe (a) the author,
    // (b) everyone who has replied, (c) every current coordinator of the hub.
    // That preserves the prior implicit behavior — anyone who would have been
    // notified before stays notified going forward.
    name: "create_hub_thread_subscriptions",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'create_hub_thread_subscriptions_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "hub_thread_subscriptions" (
          "id"           TEXT PRIMARY KEY,
          "threadId"     TEXT NOT NULL REFERENCES "hub_conversation_threads"("id") ON DELETE CASCADE,
          "userId"       TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "subscribedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "source"       TEXT NOT NULL,
          UNIQUE("threadId", "userId")
        )
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "hub_thread_subscriptions_threadId_idx"
          ON "hub_thread_subscriptions"("threadId")
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "hub_thread_subscriptions_userId_idx"
          ON "hub_thread_subscriptions"("userId")
      `);

      // Backfill — three sources, ON CONFLICT DO NOTHING to handle overlaps.
      // Authors:
      const authorRes = await db.$executeRawUnsafe(`
        INSERT INTO "hub_thread_subscriptions" ("id", "threadId", "userId", "source")
        SELECT
          'sub_' || substr(md5(random()::text || t."id" || t."authorId"), 1, 24),
          t."id", t."authorId", 'AUTHOR'
        FROM "hub_conversation_threads" t
        ON CONFLICT ("threadId", "userId") DO NOTHING
      `);

      // Repliers (distinct user per thread):
      const replierRes = await db.$executeRawUnsafe(`
        INSERT INTO "hub_thread_subscriptions" ("id", "threadId", "userId", "source")
        SELECT
          'sub_' || substr(md5(random()::text || r."threadId" || r."authorId"), 1, 24),
          r."threadId", r."authorId", 'ADDED'
        FROM (
          SELECT DISTINCT "threadId", "authorId" FROM "hub_conversation_replies"
        ) r
        ON CONFLICT ("threadId", "userId") DO NOTHING
      `);

      // Current coordinators of each hub (active, communications enabled):
      const coordRes = await db.$executeRawUnsafe(`
        INSERT INTO "hub_thread_subscriptions" ("id", "threadId", "userId", "source")
        SELECT
          'sub_' || substr(md5(random()::text || t."id" || hm."userId"), 1, 24),
          t."id", hm."userId", 'COORDINATOR_AUTO'
        FROM "hub_conversation_threads" t
        JOIN "hub_members" hm
          ON hm."hubId" = t."hubId"
         AND hm."isCoordinator" = TRUE
         AND hm."status" = 'ACTIVE'
        ON CONFLICT ("threadId", "userId") DO NOTHING
      `);

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('create_hub_thread_subscriptions_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (authors:${authorRes}, repliers:${replierRes}, coordinators:${coordRes})`);
    },
  },
  {
    // Session 113 — Two-stage delete for hub documents + conversations.
    //
    // Adds GUIDING_TEACHER to the Role enum (sangha-wide dharma authority,
    // distinct from ADMIN; Jesse currently holds both).
    //
    // HubDocument gains archive + trash columns:
    //   archivedAt / archivedById — set when archived (read-only, "Archived" filter)
    //   deletedAt  / deletedById  — set when soft-deleted (visible only to trash-managers)
    //
    // HubConversationThread gains trash columns only — `status: CLOSED`
    // already serves as the archive concept for threads.
    name: "add_hub_archive_and_trash_columns",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'add_hub_archive_and_trash_columns_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      // Role enum — IF NOT EXISTS is supported in Postgres 12+.
      await db.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'GUIDING_TEACHER'`);

      // HubDocument columns
      await db.$executeRawUnsafe(`ALTER TABLE "hub_documents" ADD COLUMN IF NOT EXISTS "archivedAt"   TIMESTAMPTZ`);
      await db.$executeRawUnsafe(`ALTER TABLE "hub_documents" ADD COLUMN IF NOT EXISTS "archivedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL`);
      await db.$executeRawUnsafe(`ALTER TABLE "hub_documents" ADD COLUMN IF NOT EXISTS "deletedAt"    TIMESTAMPTZ`);
      await db.$executeRawUnsafe(`ALTER TABLE "hub_documents" ADD COLUMN IF NOT EXISTS "deletedById"  TEXT REFERENCES "users"("id") ON DELETE SET NULL`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hub_documents_hubId_deletedAt_idx" ON "hub_documents"("hubId", "deletedAt")`);

      // HubConversationThread columns
      await db.$executeRawUnsafe(`ALTER TABLE "hub_conversation_threads" ADD COLUMN IF NOT EXISTS "deletedAt"   TIMESTAMPTZ`);
      await db.$executeRawUnsafe(`ALTER TABLE "hub_conversation_threads" ADD COLUMN IF NOT EXISTS "deletedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "hub_conversation_threads_hubId_deletedAt_idx" ON "hub_conversation_threads"("hubId", "deletedAt")`);

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('add_hub_archive_and_trash_columns_v1')
      `);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Session 113 — Host-assignment confirmation + removal templates.
    //
    // Audit found that when a host claimed a sub-request or self-claimed a
    // session, they received no confirmation email — only the original
    // requester was notified. Other assignment paths (manager assigns,
    // PATCH claim, reassign) likewise sent nothing to the new host.
    //
    // Two new templates power the unified confirmation flow:
    //   host-assignment-confirmation — sent to anyone who becomes a host,
    //     whether via sub-claim, self-claim, manager assignment, or reassign
    //   host-assignment-removed      — sent to a host displaced by manager
    //     reassign (standing-rotation displacement keeps its hardcoded email)
    //
    // Defensive seed: findUnique → create. Manual edits via /admin/emails
    // are preserved.
    name: "seed_host_assignment_email_templates",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_host_assignment_email_templates_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const templates = [
        {
          slug: "host-assignment-confirmation",
          name: "Host Assignment Confirmation",
          description: "Sent to a host when they become responsible for a session — sub-claim, self-claim, manager assignment, or reassign. (Standing rotations use a separate batched email.)",
          enabled: true,
          group: "04-hosts",
          groupLabel: "Host Team",
          subject: "You're hosting {{programName}}{{#if dateText}} — {{dateText}}{{/if}}",
          variables: ["firstName", "programName", "dateText", "requesterNote", "scheduleUrl"],
          body: `Hi {{firstName}},

You're confirmed to host **{{programName}}**{{#if dateText}} on {{dateText}}{{/if}}. Thank you.

{{#if requesterNote}}
> {{requesterNote}}
{{/if}}

**[View the Host Schedule →]({{scheduleUrl}})**

If anything changes and you need coverage, you can post a sub-request from the schedule page.

---
Rooted In Mindfulness · Brookfield, WI`,
        },
        {
          slug: "host-assignment-removed",
          name: "Host Assignment Removed",
          description: "Sent to a host when a coordinator reassigns their session to someone else. (Standing rotations use a separate batched email for the same situation.)",
          enabled: true,
          group: "04-hosts",
          groupLabel: "Host Team",
          subject: "You're no longer hosting {{programName}}{{#if dateText}} on {{dateText}}{{/if}}",
          variables: ["firstName", "programName", "dateText", "byName", "scheduleUrl"],
          body: `Hi {{firstName}},

**{{byName}}** has reassigned **{{programName}}**{{#if dateText}} on {{dateText}}{{/if}} to another host — you're no longer scheduled for this session.

If you have questions about this change, please reach out to your coordinator.

**[View the Host Schedule →]({{scheduleUrl}})**

---
Rooted In Mindfulness · Brookfield, WI`,
        },
      ];

      let created = 0;
      let skipped = 0;
      for (const t of templates) {
        const existing = await db.emailTemplate.findUnique({ where: { slug: t.slug } });
        if (existing) { skipped++; continue; }
        await db.emailTemplate.create({ data: t });
        created++;
      }

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_host_assignment_email_templates_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${created} created, ${skipped} preserved)`);
    },
  },
  {
    // Session 113 — Drop the orphaned `support-notification` email template.
    //
    // The Support Inbox application was removed in session 100; its supporting
    // residue (HubAppLinks, the `support-inbox` ManualSection) was stripped in
    // session 110. But the EmailTemplate row was missed — it has sat in the DB
    // since session 96 with no sender, no UI consumer, and an irrelevant
    // group/groupLabel ("Support Inbox") cluttering /admin/emails.
    //
    // This migration deletes the row. No-op on fresh DBs (the row was never
    // created there because we're simultaneously dropping the seed migration
    // from this file).
    name: "drop_support_notification_template",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'drop_support_notification_template_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const result = await db.emailTemplate.deleteMany({
        where: { slug: "support-notification" },
      });

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('drop_support_notification_template_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${result.count} row${result.count === 1 ? "" : "s"} removed)`);
    },
  },
  {
    // Session 114 — Document conversations.
    //
    // HubConversationThread gains an optional documentId FK so threads can be
    // associated with a specific hub document. The hub Conversations feed
    // filters to documentId: null; document threads live on the document page
    // and in the unified Activity stream.
    name: "add_document_id_to_hub_conversation_threads",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'add_document_id_to_hub_conversation_threads_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      await db.$executeRawUnsafe(`
        ALTER TABLE "hub_conversation_threads"
        ADD COLUMN IF NOT EXISTS "documentId" TEXT
        REFERENCES "hub_documents"("id") ON DELETE CASCADE
      `);
      await db.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "hub_conversation_threads_documentId_idx"
        ON "hub_conversation_threads"("documentId")
      `);

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('add_document_id_to_hub_conversation_threads_v1')
      `);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Session 115 — archive-mechanism unification for hub threads.
    //
    // HubDocument used `archivedAt DateTime?` for its archive marker; threads
    // used the overloaded `status: "CLOSED"`. The inventory found that several
    // query sites had drifted to `status: { not: "ARCHIVED" }` (an enum value
    // that doesn't exist — the filter never matched), and the asymmetry made
    // the model harder to keep correct.
    //
    // This migration:
    //   1. Adds archivedAt + archivedById columns to hub_conversation_threads
    //   2. Backfills archivedAt = updatedAt for every row with status = 'CLOSED'
    //      (archivedById stays null — we don't know who closed historical rows)
    //
    // The PATCH route keeps status in sync going forward so legacy clients
    // that still read it continue to work. A future cleanup can drop the
    // status column once nothing reads it.
    name: "add_archived_columns_to_hub_threads",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'add_archived_columns_to_hub_threads_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      await db.$executeRawUnsafe(`
        ALTER TABLE "hub_conversation_threads"
        ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ
      `);
      await db.$executeRawUnsafe(`
        ALTER TABLE "hub_conversation_threads"
        ADD COLUMN IF NOT EXISTS "archivedById" TEXT
        REFERENCES "users"("id") ON DELETE SET NULL
      `);

      // Backfill from the legacy status column. Idempotent — the WHERE clause
      // skips rows already backfilled.
      const backfilled = await db.$executeRawUnsafe(`
        UPDATE "hub_conversation_threads"
        SET "archivedAt" = "updatedAt"
        WHERE "status" = 'CLOSED' AND "archivedAt" IS NULL
      `);
      console.log(`  ✔ Backfilled archivedAt on ${backfilled} previously-CLOSED thread(s)`);

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('add_archived_columns_to_hub_threads_v1')
      `);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    name: "create_session_chat_messages_table",
    async run() {
      const tables = await db.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'session_chat_messages'
      `);
      if (tables.length === 0) {
        await db.$executeRawUnsafe(`
          CREATE TABLE "session_chat_messages" (
            "id"            TEXT PRIMARY KEY,
            "roomName"      TEXT NOT NULL,
            "programSlug"   TEXT NOT NULL,
            "sessionDate"   TIMESTAMPTZ,
            "fromUserId"    TEXT,
            "fromIdentity"  TEXT NOT NULL,
            "fromName"      TEXT NOT NULL,
            "body"          TEXT NOT NULL,
            "toIdentities"  TEXT[] NOT NULL DEFAULT '{}',
            "sentAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX "session_chat_messages_roomName_sentAt_idx"
          ON "session_chat_messages" ("roomName", "sentAt")
        `);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    // Adds the publishOnPublicCatalog opt-in flag for the public /courses catalog.
    // Default false means new courses are private by default; admin opts each in.
    // Backfill flips existing all-members non-onboarding courses to true so the
    // currently-visible catalog stays visible after the flag ships.
    name: "add_publish_on_public_catalog_to_courses",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'courses' AND column_name = 'publishOnPublicCatalog'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`
          ALTER TABLE "courses"
          ADD COLUMN "publishOnPublicCatalog" BOOLEAN NOT NULL DEFAULT false
        `);
        // Backfill: anything currently visible on /courses (isActive=true,
        // isOnboarding=false) keeps its visibility.
        await db.$executeRawUnsafe(`
          UPDATE "courses"
          SET "publishOnPublicCatalog" = true
          WHERE "isActive" = true AND "isOnboarding" = false
        `);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    // Switch authentication from magic-link to magic-code (6-digit code).
    //
    // Why: Safari defaults to per-session permission grants, and magic links
    // open in the OS default browser — neither plays well with the PWA
    // direction or multi-browser users. Codes work in every context because
    // the user types them into whichever browser/app they're standing in.
    //
    // What this migration does:
    //   1. Creates two new templates with the new slugs (sign-in-code-new-user,
    //      sign-in-code-returning). Defensive findUnique→create — does not
    //      overwrite if a row with the new slug already exists (so admin
    //      edits via /admin/emails are preserved on re-run).
    //   2. Deletes the obsolete magic-link templates (magic-link-new-user,
    //      magic-link-returning) so /admin/emails doesn't show them.
    //
    // The new templates are ⚠️ CRITICAL — sendSignInCodeEmail uses
    // throwOnFailure so a missing or disabled template surfaces an error to
    // NextAuth (which shows "Please try again" to the user) rather than
    // silently dropping the sign-in attempt.
    name: "seed_sign_in_code_email_templates",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_sign_in_code_email_templates_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const NEW_USER_BODY = `## Welcome to Rooted In Mindfulness

Enter this code on the sign-in page to complete your account:

<p style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;font-family:ui-monospace,'SF Mono','Menlo',monospace;color:#135274;margin:24px 0;">{{code}}</p>

The code expires in 30 minutes.

If you didn't request this, you can safely ignore this email.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`;

      const RETURNING_BODY = `## Your sign-in code

Enter this code on the sign-in page to access your account:

<p style="font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;font-family:ui-monospace,'SF Mono','Menlo',monospace;color:#135274;margin:24px 0;">{{code}}</p>

The code expires in 30 minutes.

If you didn't request this, you can safely ignore this email.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`;

      const templates = [
        {
          slug: "sign-in-code-new-user",
          name: "Sign-in Code — New User",
          description: "⚠️ CRITICAL: required for sign-up. Sent by NextAuth when a first-time visitor enters their email. Contains the 6-digit code they need to enter on the sign-in page.",
          enabled: true,
          subject: "Your Rooted In Mindfulness sign-in code: {{code}}",
          variables: ["code"],
          group: "01-auth",
          groupLabel: "Sign-in & Authentication",
          helpText:
            "⚠️ CRITICAL — required for new-account sign-up.\n\n" +
            "Sent automatically by NextAuth when a first-time visitor enters their email address. Contains the 6-digit code they enter on the sign-in page to complete account creation. If this template is disabled, OR if the {{code}} variable is removed from the body, sign-up breaks immediately for everyone.\n\n" +
            "SAFE to edit: subject line, greeting, body copy, surrounding language.\n\n" +
            "DO NOT: disable the \"Enabled\" toggle, remove or rename {{code}}, or remove the code display block entirely.\n\n" +
            "If sign-up appears broken: confirm this template is Enabled and the body still contains {{code}}.",
          body: NEW_USER_BODY,
        },
        {
          slug: "sign-in-code-returning",
          name: "Sign-in Code — Returning User",
          description: "⚠️ CRITICAL: required for sign-in. Sent by NextAuth when an existing member enters their email. Contains the 6-digit code they need to enter on the sign-in page.",
          enabled: true,
          subject: "Your Rooted In Mindfulness sign-in code: {{code}}",
          variables: ["code"],
          group: "01-auth",
          groupLabel: "Sign-in & Authentication",
          helpText:
            "⚠️ CRITICAL — required for member sign-in.\n\n" +
            "Sent automatically by NextAuth when an existing member enters their email address. Contains the 6-digit code they enter on the sign-in page to access their account. If this template is disabled, OR if the {{code}} variable is removed from the body, sign-in breaks immediately for everyone.\n\n" +
            "SAFE to edit: subject line, greeting, body copy, surrounding language.\n\n" +
            "DO NOT: disable the \"Enabled\" toggle, remove or rename {{code}}, or remove the code display block entirely.\n\n" +
            "If sign-in appears broken: confirm this template is Enabled and the body still contains {{code}}.",
          body: RETURNING_BODY,
        },
      ];

      // Defensive findUnique → create (per CLAUDE.md Email Template Gate):
      // preserves any admin edits made via /admin/emails on re-run.
      let createdCount = 0;
      for (const t of templates) {
        const existing = await db.emailTemplate.findUnique({ where: { slug: t.slug } });
        if (!existing) {
          await db.emailTemplate.create({ data: t });
          createdCount++;
        }
      }

      // Remove the obsolete magic-link templates.
      const removed = await db.emailTemplate.deleteMany({
        where: { slug: { in: ["magic-link-new-user", "magic-link-returning"] } },
      });

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_sign_in_code_email_templates_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${createdCount} created, ${removed.count} removed)`);
    },
  },
  {
    // Bump the sign-in code expiry in the email body copy from "10 minutes"
    // to "30 minutes" to match the new auth.ts maxAge of 30 minutes.
    //
    // The seed migration above is flag-gated and won't re-run, so the body
    // text it wrote into production still says "10 minutes." This migration
    // updates existing rows in place — but only if the body still contains
    // the original "expires in 10 minutes" string. If an admin has edited
    // the body via /admin/emails to say something else, the LIKE filter
    // excludes it, so admin edits are preserved.
    name: "update_sign_in_code_expiry_copy_to_30min",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'update_sign_in_code_expiry_copy_to_30min_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      // Raw SQL uses the Postgres table name (via @@map in schema.prisma)
      // — "email_templates", NOT the Prisma model name "EmailTemplate".
      const updated = await db.$executeRawUnsafe(`
        UPDATE "email_templates"
        SET body = REPLACE(body, 'expires in 10 minutes', 'expires in 30 minutes')
        WHERE slug IN ('sign-in-code-new-user', 'sign-in-code-returning')
          AND body LIKE '%expires in 10 minutes%'
      `);

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('update_sign_in_code_expiry_copy_to_30min_v1')
      `);
      console.log(`  ✔ Applied: ${this.name} (${updated} rows updated)`);
    },
  },
  {
    // Course offering model — orthogonal-flags slice (session 123).
    //
    // Per RIM_Offering_Model.md (decided session 118), Course is moving from
    // a single `accessLevel` enum to orthogonal flags so one Course can carry
    // multiple acquisition paths simultaneously (e.g. live cohort + standalone
    // dana). Plus new content fields for the /course/[slug] landing-page
    // redesign that mirrors /programs/[slug].
    //
    // This migration ADDS the columns and BACKFILLS the flag values from the
    // existing accessLevel for every current course. The accessLevel enum
    // stays in the schema — reads migrate to the flags first (next slice),
    // then the enum drops in a later pass. No silent behavior changes:
    // every current course preserves its current access semantics.
    //
    // Backfill rules (from RIM_Offering_Model.md):
    //   ALL_MEMBERS           → allowSelfEnroll=true,  selfEnrollDanaRequired=false
    //   REGISTRATION_REQUIRED → allowSelfEnroll=false  (rely on ProgramCourse linkage)
    //   ROLE_REQUIRED         → allowSelfEnroll=true   (existing requiredRoles carries over)
    //
    // Idempotent: the information_schema check guards the ADD COLUMN, and
    // the UPDATE statements are inside the same guard so they only run on
    // the first application (when the columns are freshly added and all
    // flag values are at their false/null defaults). Re-running is a no-op.
    name: "add_course_offering_flags",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'courses' AND column_name = 'allowSelfEnroll'
      `);
      if (cols.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      // Raw SQL uses the Postgres table name (via @@map in schema.prisma)
      // — "courses", NOT the Prisma model name "Course".
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "allowSelfEnroll" BOOLEAN NOT NULL DEFAULT false`);
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "selfEnrollDanaRequired" BOOLEAN NOT NULL DEFAULT false`);
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "accessRestrictionMessage" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "heroImage" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "pullQuote" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "pullQuoteSource" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "danaText" TEXT`);

      // Backfill from the existing accessLevel enum. Order matters only for
      // human readability — the three WHERE clauses are disjoint.
      const allMembersCount = await db.$executeRawUnsafe(`
        UPDATE "courses"
        SET "allowSelfEnroll" = true, "selfEnrollDanaRequired" = false
        WHERE "accessLevel" = 'ALL_MEMBERS'
      `);
      const regRequiredCount = await db.$executeRawUnsafe(`
        UPDATE "courses"
        SET "allowSelfEnroll" = false
        WHERE "accessLevel" = 'REGISTRATION_REQUIRED'
      `);
      const roleRequiredCount = await db.$executeRawUnsafe(`
        UPDATE "courses"
        SET "allowSelfEnroll" = true
        WHERE "accessLevel" = 'ROLE_REQUIRED'
      `);

      console.log(
        `  ✔ Applied: ${this.name} ` +
        `(ALL_MEMBERS=${allMembersCount}, REGISTRATION_REQUIRED=${regRequiredCount}, ROLE_REQUIRED=${roleRequiredCount})`
      );
    },
  },
  {
    // Course offering — dana self-enroll columns on Donation (session 123,
    // slice 4). Adds courseId / courseTitle so a Stripe Checkout payment
    // for a course self-enroll can be ledgered without overloading the
    // existing programId field. Both nullable — existing program-dana
    // rows remain untouched.
    name: "add_course_columns_to_donations",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'donations' AND column_name = 'courseId'
      `);
      if (cols.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }
      await db.$executeRawUnsafe(`ALTER TABLE "donations" ADD COLUMN "courseId" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE "donations" ADD COLUMN "courseTitle" TEXT`);
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // Course offering — full dana model (session 123, slice 5). Mirrors the
    // Program dana fields so the two offering types feel like peers.
    //
    //   danaMode        "none" | "voluntary" | "base_plus_dana" | "fixed"
    //   suggestedDana   Float?  — default for voluntary mode
    //   danaBaseAmount  Float?  — minimum for base_plus_dana mode
    //   danaFixedAmount Float?  — exact amount for fixed mode
    //   danaMessage     Jsonb?  — Tiptap rich-text shown at checkout
    //
    // Backfill: existing courses with selfEnrollDanaRequired = true map to
    // "voluntary" (the safest interpretation — admin sets a suggestedDana
    // later if they want). All others become "none". selfEnrollDanaRequired
    // is preserved as a derived mirror; the new flag (danaMode !== "none")
    // is the source of truth going forward.
    name: "add_course_dana_model",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'courses' AND column_name = 'danaMode'
      `);
      if (cols.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "danaMode" TEXT NOT NULL DEFAULT 'none'`);
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "suggestedDana" DOUBLE PRECISION`);
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "danaBaseAmount" DOUBLE PRECISION`);
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "danaFixedAmount" DOUBLE PRECISION`);
      await db.$executeRawUnsafe(`ALTER TABLE "courses" ADD COLUMN "danaMessage" JSONB`);

      // Backfill from selfEnrollDanaRequired.
      const voluntaryCount = await db.$executeRawUnsafe(`
        UPDATE "courses"
        SET "danaMode" = 'voluntary'
        WHERE "selfEnrollDanaRequired" = true
      `);

      console.log(`  ✔ Applied: ${this.name} (voluntary=${voluntaryCount})`);
    },
  },
  {
    // Email Template Gate (CLAUDE.md): sendCourseDanaReceiptEmail's matching
    // seed entry. Sent by the Stripe webhook when a member completes
    // course self-enroll dana. Doubles as enrollment confirmation —
    // the SeriesEnrollment was created in the same handler.
    //
    // Defensive findUnique → create so any admin edits at /admin/emails
    // are preserved on re-run.
    name: "seed_course_dana_receipt_email_template",
    async run() {
      const flag = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags"
        WHERE name = 'seed_course_dana_receipt_email_template_v1'
      `).catch(() => []);
      if (flag.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      const existing = await db.emailTemplate.findUnique({
        where: { slug: "course-dana-receipt" },
      });

      if (!existing) {
        await db.emailTemplate.create({
          data: {
            slug: "course-dana-receipt",
            name: "Course Dana — Receipt & Welcome",
            description:
              "Sent by Stripe webhook when a member completes course self-enroll dana. Confirms the payment AND welcomes them to the course (enrollment is created in the same step).",
            enabled: true,
            subject: "Thank you — you're enrolled in {{courseTitle}}",
            variables: ["firstName", "courseTitle", "amountUsd", "courseUrl"],
            group: "03-courses",
            groupLabel: "Courses",
            helpText:
              "Sent automatically by the Stripe webhook after a successful course self-enroll dana payment. The member is already enrolled by the time this lands — this email serves as both the receipt and the welcome.\n\n" +
              "Variables: {{firstName}}, {{courseTitle}}, {{amountUsd}} (e.g. \"50.00\" — no currency symbol), {{courseUrl}} (link to the course page).\n\n" +
              "SAFE to edit: subject, greeting, framing, the dharma context around dana.\n\n" +
              "Keep: the amount line, the course link, and the gratitude tone — this is the only confirmation the member receives.",
            body: `## Thank you, {{firstName}}.

Your dana offering of **\${{amountUsd}}** has been received, and you're now enrolled in **{{courseTitle}}**.

Dana — the practice of generosity — is what allows these teachings to be freely available to those who can't offer dana, and to sustain RIM's work. Your offering supports both. Thank you.

You can begin the course any time:

**[Open {{courseTitle}} →]({{courseUrl}})**

You'll find the full lesson library on that page. Take it at your own pace — there's no schedule to keep up with. Pause for as long as you need between lessons, return when something calls you back.

If anything doesn't work or you have a question about the material, just reply to this email.

---
Rooted In Mindfulness · Brookfield, WI · rootedinmindfulness.org`,
          },
        });
        console.log(`  ✔ Applied: ${this.name} (created)`);
      } else {
        console.log(`  ✔ Applied: ${this.name} (already exists — preserved)`);
      }

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `).catch(() => {});
      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('seed_course_dana_receipt_email_template_v1')
      `);
    },
  },
  {
    // Provisional state for required-payment registrations: the row exists as
    // the Stripe Checkout anchor but is invisible to member/registrar views
    // until payment confirms (or auto-expires on abandonment). IF NOT EXISTS
    // makes this idempotent on every deploy; ADD VALUE runs outside a txn
    // (per-statement autocommit), as with the GUIDING_TEACHER precedent above.
    name: "add_pending_payment_registration_status",
    async run() {
      await db.$executeRawUnsafe(
        `ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT'`
      );
      console.log(`  ✔ Applied: ${this.name}`);
    },
  },
  {
    // LorieLee request: notify support@ each time a registration becomes
    // official, with a direct link to the program's registrations. Seed-only
    // (findUnique → create) per the Email Template Gate — never overwrite an
    // edited body. The danaStatus/status variables arrive pre-labeled from
    // lib/email.ts::sendRegistrationSupportNotification.
    name: "seed_registration_support_notification_email",
    async run() {
      const slug = "registration-support-notification";
      const existing = await db.emailTemplate.findUnique({ where: { slug } });
      if (existing) {
        console.log(`  ⏭ Already seeded: ${slug}`);
        return;
      }
      await db.emailTemplate.create({
        data: {
          slug,
          name: "New Registration — Support Notification",
          description:
            "Sent to support@ each time a registration becomes official (free at submit; voluntary once the member gives or declines; paid once payment clears; waitlist at submit). Not sent for abandoned or unpaid holds. Carries a direct link to the program's registrations.",
          enabled: true,
          subject: "New registration: {{registrantName}} — {{programTitle}}",
          variables: [
            "registrantName",
            "registrantEmail",
            "programTitle",
            "status",
            "danaStatus",
            "manageUrl",
            "manageButton",
          ],
          group: "02-registrations",
          groupLabel: "Registrations",
          body: `A new registration just came in.

**{{registrantName}}** — {{status}} for **{{programTitle}}**
Email: {{registrantEmail}}
Dana: {{danaStatus}}

{{{manageButton}}}

Or open it directly: {{manageUrl}}`,
        },
      });
      console.log(`  ✔ Seeded: ${slug}`);
    },
  },
  {
    /**
     * Session 137 — Offering KIND on ProgramCategory.
     *
     * Adds the `kind` column (always, idempotent), then one-shot: backfills the
     * six live categories, renames "Community Groups & Events" → "Community
     * Groups", creates an "Events" category and a hidden "Private Sessions"
     * category, and reassigns the affected programs to their correct kind home.
     *
     * Flag-guarded so a coordinator's later kind/category edits via the category
     * manager are never clobbered on a subsequent deploy. Slugs are kept stable
     * as join keys — only display names + kinds change. See RIM_Offering_Model.md.
     */
    name: "add_program_category_kind",
    async run() {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
      `);
      // Column add is always safe to attempt; the data restructuring below is
      // flag-guarded so it runs exactly once.
      await db.$executeRawUnsafe(`
        ALTER TABLE "program_categories" ADD COLUMN IF NOT EXISTS "kind" TEXT
      `);

      const flagged = await db.$queryRawUnsafe(`
        SELECT name FROM "_migration_flags" WHERE name = '${this.name}_v1'
      `);
      if (Array.isArray(flagged) && flagged.length > 0) {
        console.log(`  ⏭ Already applied: ${this.name}`);
        return;
      }

      // 1. Backfill kind on the six existing categories (by slug).
      const KIND_BY_SLUG = {
        "drop-ins": "DROP_IN",
        "silent-meditation": "DROP_IN",
        "classes-courses-workshops": "CLASS",
        "community-service": "SERVICE",
        "retreats": "RETREAT",
        "community-groups-events": "COMMUNITY_GROUP", // renamed in step 2
      };
      for (const [slug, kind] of Object.entries(KIND_BY_SLUG)) {
        await db.programCategory.updateMany({ where: { slug }, data: { kind } });
      }

      // 2. Rename "Community Groups & Events" → "Community Groups" (slug kept
      //    stable; only the display name changes).
      await db.programCategory.updateMany({
        where: { slug: "community-groups-events" },
        data: { name: "Community Groups" },
      });

      // 3. Create "Events" + hidden "Private Sessions".
      const maxOrder = await db.programCategory.aggregate({ _max: { sortOrder: true } });
      let nextOrder = (maxOrder._max.sortOrder ?? 0) + 1;
      const events = await db.programCategory.upsert({
        where:  { slug: "events" },
        update: { kind: "EVENT" },
        create: { slug: "events", name: "Events", kind: "EVENT", sortOrder: nextOrder++ },
      });
      const priv = await db.programCategory.upsert({
        where:  { slug: "private-sessions" },
        update: { kind: "PRIVATE", hideFromProgramsPage: true },
        create: { slug: "private-sessions", name: "Private Sessions", kind: "PRIVATE", sortOrder: nextOrder++, hideFromProgramsPage: true },
      });

      // 4. Reassign the affected programs to their correct kind home.
      //    Stay put: qigong-at-rim, recovery-dharma, nature-meditation-km-group
      //    (Community Groups); the-heart-of-wisdom (Retreats).
      const toEvents = await db.program.updateMany({
        where: { slug: { in: ["bookmarks-and-breath", "day-of-mindfulness"] } },
        data:  { categoryId: events.id },
      });
      const toPrivate = await db.program.updateMany({
        where: { slug: "private-teacher-meetings" },
        data:  { categoryId: priv.id },
      });

      await db.$executeRawUnsafe(`
        INSERT INTO "_migration_flags" (name) VALUES ('${this.name}_v1')
        ON CONFLICT DO NOTHING
      `);
      console.log(
        `  ✔ Applied: ${this.name} — kinds backfilled; Events + Private Sessions created; ` +
        `${toEvents.count} → Events, ${toPrivate.count} → Private Sessions`,
      );
    },
  },
  {
    // Per-occurrence Zoom meeting storage (Zoom migration — "RIM orchestrates,
    // Zoom is the room"). Additive: a new table, nothing existing touched.
    name: "create_session_meetings_table",
    async run() {
      const tables = await db.$queryRawUnsafe(`
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'session_meetings'
      `);
      if (tables.length === 0) {
        await db.$executeRawUnsafe(`
          CREATE TABLE "session_meetings" (
            "id"            TEXT PRIMARY KEY,
            "programSlug"   TEXT NOT NULL,
            "sessionDate"   TIMESTAMPTZ NOT NULL,
            "endTime"       TIMESTAMPTZ NOT NULL,
            "seatUserId"    TEXT NOT NULL,
            "zoomMeetingId" TEXT NOT NULL,
            "recordToCloud" BOOLEAN NOT NULL DEFAULT false,
            "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await db.$executeRawUnsafe(`
          CREATE UNIQUE INDEX "session_meetings_programSlug_sessionDate_key"
          ON "session_meetings" ("programSlug", "sessionDate")
        `);
        await db.$executeRawUnsafe(`
          CREATE INDEX "session_meetings_seatUserId_sessionDate_idx"
          ON "session_meetings" ("seatUserId", "sessionDate")
        `);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
  {
    // Per-program "auto-record sessions to the cloud" flag (Zoom). Audio-only is
    // governed by the seats' Zoom recording settings. Additive column.
    name: "add_record_by_default_to_programs",
    async run() {
      const cols = await db.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'programs' AND column_name = 'recordByDefault'
      `);
      if (cols.length === 0) {
        await db.$executeRawUnsafe(`
          ALTER TABLE "programs" ADD COLUMN "recordByDefault" BOOLEAN NOT NULL DEFAULT false
        `);
        console.log(`  ✔ Applied: ${this.name}`);
      } else {
        console.log(`  ⏭ Already applied: ${this.name}`);
      }
    },
  },
];

// ── Server-safe compute helpers (mirror of lib/programUtils.ts) ──────────────
// Inlined here because migrate.mjs is plain ESM and can't import .ts directly.
// Keep in sync with lib/programUtils.ts.

const _DAY_FULL = {
  SU: "Sundays", MO: "Mondays", TU: "Tuesdays", WE: "Wednesdays",
  TH: "Thursdays", FR: "Fridays", SA: "Saturdays",
};
const _DAY_ORDER = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const _TZ = "America/Chicago";

function _toCtLocalString(input) {
  if (!input) return "";
  if (typeof input === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return input;
    const d = new Date(input);
    if (isNaN(d.getTime())) return "";
    return _toCtLocalString(d);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: _TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(input);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

function _fmtCalendarDate(y, m, d, withYear) {
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function _fmtDateRange(s, e) {
  if (s.y === e.y && s.m === e.m) {
    return `${_fmtCalendarDate(s.y, s.m, s.d, false)}–${e.d}, ${e.y}`;
  }
  if (s.y === e.y) {
    return `${_fmtCalendarDate(s.y, s.m, s.d, false)} – ${_fmtCalendarDate(e.y, e.m, e.d, false)}, ${e.y}`;
  }
  return `${_fmtCalendarDate(s.y, s.m, s.d, true)} – ${_fmtCalendarDate(e.y, e.m, e.d, true)}`;
}

function computeTimeText(start, end) {
  const startStr = _toCtLocalString(start);
  if (!startStr) return "";
  const endStr = _toCtLocalString(end);
  const parseTime = (dt) => {
    const t = dt.split("T")[1];
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return { h, m };
  };
  const fmt = (h, m) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mStr = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
    return { str: `${h12}${mStr}`, ampm };
  };
  const s = parseTime(startStr);
  if (!s) return "";
  const { str: sStr, ampm: sAmpm } = fmt(s.h, s.m);

  // Multi-day span — show the start time as an arrival cue, not "4–12 PM".
  if (endStr && endStr.split("T")[0] !== startStr.split("T")[0]) {
    return `Begins ${sStr} ${sAmpm} CT`;
  }

  if (endStr) {
    const e = parseTime(endStr);
    if (e) {
      const { str: eStr, ampm: eAmpm } = fmt(e.h, e.m);
      if (sAmpm === eAmpm) return `${sStr}–${eStr} ${eAmpm} CT`;
      return `${sStr} ${sAmpm}–${eStr} ${eAmpm} CT`;
    }
  }
  return `${sStr} ${sAmpm} CT`;
}

function _monthlyPatternPhrase(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dow = new Date(y, m - 1, d).getDay();
  let occ = 0;
  for (let i = 1; i <= d; i++) if (new Date(y, m - 1, i).getDay() === dow) occ++;
  const daysInMonth = new Date(y, m, 0).getDate();
  let total = 0;
  for (let i = 1; i <= daysInMonth; i++) if (new Date(y, m - 1, i).getDay() === dow) total++;
  const ord = occ === total ? "last" : (["", "1st", "2nd", "3rd", "4th", "5th"][occ] || "");
  return ord ? `${ord} ${names[dow]}` : "";
}

function computeDateText(start, freq, days, interval, end) {
  const daysList = days ?? [];
  const intervalStr = interval == null ? "" : String(interval);
  if (freq === "WEEKLY") {
    const ordered = [...daysList].sort((a, b) => _DAY_ORDER.indexOf(a) - _DAY_ORDER.indexOf(b));
    const names = ordered.map((d) => _DAY_FULL[d] ?? d);
    const prefix = intervalStr && Number(intervalStr) > 1 ? `Every ${intervalStr} weeks: ` : "";
    if (names.length === 0) return `${prefix}Weekly`;
    if (names.length === 1) return `${prefix}${names[0]}`;
    if (names.length === 2) return `${prefix}${names[0]} and ${names[1]}`;
    const last = names[names.length - 1];
    return `${prefix}${names.slice(0, -1).join(", ")}, and ${last}`;
  }
  if (freq === "DAILY") {
    const n = Number(intervalStr);
    return !intervalStr || n <= 1 ? "Daily" : `Every ${n} days`;
  }
  if (freq === "MONTHLY") {
    const sStr = _toCtLocalString(start);
    const sDate = sStr ? sStr.split("T")[0] : "";
    const phrase = sDate ? _monthlyPatternPhrase(sDate) : "";
    const n = Number(intervalStr);
    if (!phrase) return !intervalStr || n <= 1 ? "Monthly" : `Every ${n} months`;
    const cap = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    return !intervalStr || n <= 1 ? `${cap} of the month` : `Every ${n} months on the ${phrase}`;
  }
  const startStr = _toCtLocalString(start);
  if (!startStr) return "";
  const startDate = startStr.split("T")[0];
  if (!startDate) return "";
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const endStr = _toCtLocalString(end);
  const endDate = endStr ? endStr.split("T")[0] : "";
  if (endDate && endDate !== startDate) {
    const [ey, em, ed] = endDate.split("-").map(Number);
    return _fmtDateRange({ y: sy, m: sm, d: sd }, { y: ey, m: em, d: ed });
  }
  return _fmtCalendarDate(sy, sm, sd, true);
}

// ── Minimal BlockNote → HTML converter (migration-only) ──────────────────────
// Handles common prose block types found in hub welcome/home content.
// Custom dharma blocks are not expected here; they'll be no-ops if present.

function isBlockNoteArray(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    typeof value[0].type === "string" &&
    "id" in value[0]
  );
}

function bnInlineToText(content) {
  return (content || []).map((c) => {
    if (!c) return "";
    if (c.type === "link") {
      const href = c.href ?? "#";
      return `<a href="${href}">${bnInlineToText(c.content || [])}</a>`;
    }
    let t = c.text ?? "";
    if (!t) return "";
    if (c.styles?.bold)      t = `<strong>${t}</strong>`;
    if (c.styles?.italic)    t = `<em>${t}</em>`;
    if (c.styles?.underline) t = `<u>${t}</u>`;
    if (c.styles?.strike)    t = `<s>${t}</s>`;
    if (c.styles?.code)      t = `<code>${t}</code>`;
    return t;
  }).join("");
}

function bnBlockToHtml(block) {
  const inner = Array.isArray(block.content) ? bnInlineToText(block.content) : "";
  const children = Array.isArray(block.children)
    ? block.children.map(bnBlockToHtml).join("")
    : "";
  switch (block.type) {
    case "heading": {
      const lvl = block.props?.level ?? 2;
      return `<h${lvl}>${inner}</h${lvl}>${children}`;
    }
    case "bulletListItem":
      return `<li>${inner}${children}</li>`;
    case "numberedListItem":
      return `<li>${inner}${children}</li>`;
    case "quote":
    case "blockquote":
      return `<blockquote>${inner}</blockquote>${children}`;
    case "codeBlock":
      return `<pre><code>${inner}</code></pre>${children}`;
    case "paragraph":
    default:
      return inner ? `<p>${inner}</p>${children}` : children;
  }
}

function blockNoteToHtml(blocks) {
  let html = "";
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.type === "bulletListItem") {
      let items = "";
      while (i < blocks.length && blocks[i].type === "bulletListItem") {
        items += bnBlockToHtml(blocks[i++]);
      }
      html += `<ul>${items}</ul>`;
    } else if (block.type === "numberedListItem") {
      let items = "";
      while (i < blocks.length && blocks[i].type === "numberedListItem") {
        items += bnBlockToHtml(blocks[i++]);
      }
      html += `<ol>${items}</ol>`;
    } else {
      html += bnBlockToHtml(block);
      i++;
    }
  }
  return html;
}

async function main() {
  // Skip cleanly when there's no DB env (Vercel preview builds, local builds
  // without env). Production deploys always set POSTGRES_PRISMA_URL.
  if (!process.env.POSTGRES_PRISMA_URL) {
    console.log("⏭  POSTGRES_PRISMA_URL not set — skipping migrations.");
    console.log("   Normal for preview builds; production sets this env var.");
    return;
  }
  console.log("Running migrations...");
  // Ensure flag table exists before any migration runs (some check it before any
  // migration has had a chance to CREATE TABLE IF NOT EXISTS it).
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())
  `);
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
    SELECT name FROM "_migration_flags" WHERE name = 'seed_manual_program_manager_v5'
  `).catch(() => []);

  if (manualFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_manual_program_manager_v5')`);
  } else {
    console.log("  ⏭ Program Manager manual already seeded.");
  }

  // Host Hub Team Management manual section — idempotent via flag
  const hostHubManualFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_manual_host_hub_team_management_v1'
  `).catch(() => []);

  if (hostHubManualFlag.length === 0) {
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
    // Push down the section that previously occupied this slot to make room.
    // (The support-inbox row that used to sit at order 8 was deleted in
    //  session 110's residue cleanup.) updateMany is a no-op when the row
    // is already at the target order.
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_manual_host_schedule_v1')`);
  } else {
    console.log("  ⏭ Host Schedule manual already seeded.");
  }

  // Host Hub onboarding documents (Your First Time Hosting, etc.) — native
  // HubDocuments scoped to the host-team hub. The seed is idempotent at the
  // record level (upserts by hub + label) so re-running just updates the
  // body content. The migration flag prevents re-running unless we want to.
  const hostOnboardingDocsFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_host_hub_onboarding_docs_v1'
  `).catch(() => []);

  if (hostOnboardingDocsFlag.length === 0) {
    await seedHostHubOnboardingDocs(db);
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_host_hub_onboarding_docs_v1')`);
  } else {
    console.log("  ⏭ Host Hub onboarding docs already seeded.");
  }

  // Host Hub team documents — six docs across four new categories
  // (The Practice of Hosting, Running a Session, When Things Go Wrong,
  // For Coordinators). v3 corrects drift between the docs and the
  // actual session room: dropped "Remove a participant" and "Disable
  // a participant's video" from the Disruption Response and
  // Stewardship Practices gradients (no such endpoints or buttons
  // exist). Replaced step 4 with "Mute All" as a real escalation
  // option. Host Role doc no longer claims a remove-participant
  // control. Idempotent at the record level (upsert by hub + label).
  const hostTeamDocsFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_host_hub_team_docs_v3'
  `).catch(() => []);

  if (hostTeamDocsFlag.length === 0) {
    await seedHostHubTeamDocs(db);
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_host_hub_team_docs_v3')`);
  } else {
    console.log("  ⏭ Host Hub team docs already seeded.");
  }

  // Manual chapter: host-hub orientation rewrite. Plain language, written
  // for the average host volunteer (8th-grade level, no jargon, supportive).
  // v3 corrects drift between the chapter and the actual UI: the Tasks
  // bullet was removed (Tasks tab no longer exists in the host hub) and
  // the Home description was rewritten to match what HostHubHomeClient
  // actually renders — welcome message + "Our offerings this month."
  const updateManualHostHubFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_hub_v3'
  `).catch(() => []);

  if (updateManualHostHubFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_hub_v3')`);
  } else {
    console.log("  ⏭ Manual host-hub already updated.");
  }

  // Manual chapter: host-hub-team-management rewrite. Same voice/tone
  // pass as host-hub. Coordinator-facing. Trims ~6,000 → ~1,700 words
  // while keeping all substantive information; adds the
  // release-assignments-on-pause confirmation flow.
  const updateManualTeamMgmtFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_hub_team_management_v1'
  `).catch(() => []);

  if (updateManualTeamMgmtFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_hub_team_management_v1')`);
  } else {
    console.log("  ⏭ Manual host-hub-team-management already updated.");
  }

  // Manual chapter: host-schedule refresh. Adds the Schedule | Rotations
  // tab strip section (session 98). v2 swaps named references for "the
  // host coordinator" generically.
  const updateManualHostScheduleFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_schedule_v2'
  `).catch(() => []);

  if (updateManualHostScheduleFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_schedule_v2')`);
  } else {
    console.log("  ⏭ Manual host-schedule already updated.");
  }

  // Manual chapter: host-rotations. v2 corrects drift between the chapter
  // and the actual UI: distinguishes "Set up" (empty row) from "Edit"
  // (existing row), adds the "End" button flow with its two options
  // (just stop generating vs stop and release future dates), and
  // clarifies that setting endsOn in Edit is a different path from the
  // dedicated End button.
  const updateManualHostRotationsFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_rotations_v2'
  `).catch(() => []);

  if (updateManualHostRotationsFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_rotations_v2')`);
  } else {
    console.log("  ⏭ Manual host-rotations already updated.");
  }

  // Manual chapter: host-rotations v3 — removes Pair pattern (removed from
  // UI in session 108), corrects End section (one action: end + release all
  // future dates + email hosts), adds Release one person's upcoming dates,
  // adds per-program Reset rotations, notes coordinator access.
  const updateManualHostRotationsV3Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_rotations_v3'
  `).catch(() => []);

  if (updateManualHostRotationsV3Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_rotations_v3')`);
  } else {
    console.log("  ⏭ Manual host-rotations v3 already applied.");
  }

  // Manual chapter: host-rotations v4 — adds "End on a specific date" option
  // to the Ending a rotation section (three end-panel options: release one
  // person, end on a date, end now). Also clarifies the Edit form end-date
  // field as an equivalent path for graceful wind-down.
  const updateManualHostRotationsV4Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_rotations_v4'
  `).catch(() => []);

  if (updateManualHostRotationsV4Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_rotations_v4')`);
  } else {
    console.log("  ⏭ Manual host-rotations v4 already applied.");
  }

  // Manual chapter: host-rotations v5 — session 130 follow-up rewrite.
  // Covers what Maria's beta test surfaced as gaps: the "End" → "Reset
  // [Day]" rename throughout (row button, manage panel header, destructive
  // option label, toast); the "Release their dates" → "Remove from
  // rotation" rename plus the new semantic (rule deleted, cron can't
  // re-apply); a new "Hubs as functional roles" framing paragraph so
  // coordinators working across host-team/peer-led/AV/greeter understand
  // each hub holds its own rotation pool; explicit Per-day vs Per-program
  // reset section so coordinators don't accidentally nuke all days; the
  // new cross-hub staffing view ("View all roles →" link on each program
  // card); per-session "Ask the team to cover" called out as the right
  // exit for one-date issues vs. whole-rotation removal.
  const updateManualHostRotationsV5Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_rotations_v5'
  `).catch(() => []);

  if (updateManualHostRotationsV5Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_rotations_v5')`);
  } else {
    console.log("  ⏭ Manual host-rotations v5 already applied.");
  }

  // Manual chapter: host-schedule v6 — session 130 follow-up. Three
  // updates: (1) tool renamed in session 128 from "Host Schedule" to
  // "Scheduler" — chapter title + "Getting there" section now match;
  // (2) Your Rotations panel "Next" block is now a clickable button that
  // jumps the calendar to the month of the user's earliest upcoming
  // session — new copy makes this discoverable; (3) the standing-
  // assignment confirmation email now deep-links to that month — new
  // paragraph in the Emails section explains why the "Open the Schedule"
  // button lands them on their actual rows, not a blank current month.
  const updateManualHostScheduleV6Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_schedule_v6'
  `).catch(() => []);

  if (updateManualHostScheduleV6Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_schedule_v6')`);
  } else {
    console.log("  ⏭ Manual host-schedule v6 already applied.");
  }

  // Manual chapter: host-session-room. v2 corrects drift between the
  // chapter and the actual UI: dropped "Remove a participant" and
  // "Disable a participant's camera" (no such endpoints or buttons
  // exist in RIM's session room). Reorganized "What you see" to
  // distinguish header buttons (Mute All, End for All) from the
  // participants-panel mute. Pin is via tile click, not a custom
  // button. The honest control set is now: Mute (one), Mute All,
  // End for All, Pin.
  const updateManualHostSessionRoomFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_session_room_v2'
  `).catch(() => []);

  if (updateManualHostSessionRoomFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_session_room_v2')`);
  } else {
    console.log("  ⏭ Manual host-session-room already updated.");
  }

  // Manual chapter: host-session-room. v3 adds the twelve-minute pre-session
  // section (the relational dimension from RIM_Role_Design.md — most
  // important thing a host does, absent in v2), Step in as Host as its own
  // section, Fullscreen in what-you-see, clearer navigation path, and more
  // explicit host-vs-teacher framing in during-the-session.
  const updateManualHostSessionRoomV3Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_session_room_v3'
  `).catch(() => []);

  if (updateManualHostSessionRoomV3Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_session_room_v3')`);
  } else {
    console.log("  ⏭ Manual host-session-room v3 already applied.");
  }

  // Manual chapter: host-session-room. v4 reflects the session-121 cleanup:
  // three-tier permission model (Session Host vs Co-host vs Participant),
  // tile hover-mute, chrome always visible, Share Screen / End-for-All as
  // Session-Host-only, and the ten-minute early-open window for hosts and
  // teachers.
  const updateManualHostSessionRoomV4Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_session_room_v4'
  `).catch(() => []);

  if (updateManualHostSessionRoomV4Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_session_room_v4')`);
  } else {
    console.log("  ⏭ Manual host-session-room v4 already applied.");
  }

  // Manual chapter: host-session-room. v5 adds (session 122, 2026-05-20):
  // - "Headphones are recommended" practical note under Getting into the room
  // - Bell mode section explaining the bell-button toggle that flips Krisp
  //   noise cancellation off so bells, singing bowls, and gongs pass
  //   through with their full tone preserved
  const updateManualHostSessionRoomV5Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_session_room_v5'
  `).catch(() => []);

  if (updateManualHostSessionRoomV5Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_session_room_v5')`);
  } else {
    console.log("  ⏭ Manual host-session-room v5 already applied.");
  }

  // Manual chapter: conversations. v2 corrects the reactions section:
  // reactions live on replies only, not on the thread's first message.
  // The UI shows a smile-plus picker on each reply that opens a small
  // emoji popup.
  const updateManualConversationsFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_conversations_v2'
  `).catch(() => []);

  if (updateManualConversationsFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_conversations_v2')`);
  } else {
    console.log("  ⏭ Manual conversations already updated.");
  }

  // Session 113 — rewrite the Conversations chapter to cover the new
  // subscription model (subscribers receive every reply), Follow/Unfollow
  // toggle, "Notify someone new" picker on replies, and the Archive → Trash
  // three-stage delete flow. Flag advanced to v3.
  const updateManualConversationsV3Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_conversations_v3'
  `).catch(() => []);

  if (updateManualConversationsV3Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_conversations_v3')`);
  } else {
    console.log("  ⏭ Manual conversations (v3 subscriptions + trash) already updated.");
  }

  // Session 114 — append document conversations + Activity page section
  // to the Conversations chapter.
  const updateManualConversationsV4Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_conversations_v4'
  `).catch(() => []);

  if (updateManualConversationsV4Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_conversations_v4')`);
    console.log("  ✔ Manual conversations (v4 document conversations + Activity) updated.");
  } else {
    console.log("  ⏭ Manual conversations (v4 document conversations + Activity) already updated.");
  }

  // Older chapters — option-C "remove what's wrong" pass against the
  // chapters extracted from the retired ManualContent.tsx. Each one
  // had drift accumulated since March 2026 (architecture changes,
  // tools extraction, LiveKit replacing Google Meet).
  //
  // course-hub: shorter rewrite — distinguishes Course Manager
  //   (/tools/learning) from Course Hub (/account/hub/courses/).
  // registration: surgical replace — fixed paths to /tools/programs,
  //   "Spot opened" label, course-editor reference.
  // programs: surgical replace — fixed paths, removed Google Meet
  //   section (replaced with a brief LiveKit note).
  const updateOlderManualFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_older_manual_chapters_v1'
  `).catch(() => []);

  if (updateOlderManualFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_older_manual_chapters_v1')`);
  } else {
    console.log("  ⏭ Older manual chapters already updated.");
  }

  // Manual chapter: programs (option-B full rewrite). Replaces the body
  // wholesale with a fresh chapter built from the actual Program Editor
  // UI — 7 tabs (Content, Schedule, Categories, Registration, Dana,
  // Dashboard, Visibility), conditional fields called out, Open Access
  // and Teachers documented (neither was in the original).
  const updateProgramsRewriteFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_programs_rewrite_v1'
  `).catch(() => []);

  if (updateProgramsRewriteFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_programs_rewrite_v1')`);
  } else {
    console.log("  ⏭ Manual programs rewrite already applied.");
  }

  // Manual chapter: registration (option-B full rewrite). Replaces the
  // body wholesale with a fresh chapter built from the actual
  // registration UI — the program list at /tools/programs, the
  // registration detail (VolunteerTable) with its three-column
  // expanded row and status-conditional actions, dana statuses,
  // automatic vs manually-triggered emails, course access, calendar
  // links.
  const updateRegistrationRewriteFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_registration_rewrite_v1'
  `).catch(() => []);

  if (updateRegistrationRewriteFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_registration_rewrite_v1')`);
  } else {
    console.log("  ⏭ Manual registration rewrite already applied.");
  }

  // Manual chapter: registration — dana-flow v2 (session 136). Targeted
  // updates for "completion follows the dana choice": confirmation timing,
  // the "I'm not donating at this time" decline, required-payment held/
  // discarded behavior, the "No dana" roster label, the support@ notice.
  const updateRegistrationDanaV2Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_registration_dana_v2'
  `).catch(() => []);

  if (updateRegistrationDanaV2Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_registration_dana_v2')`);
  } else {
    console.log("  ⏭ Manual registration dana-flow v2 already applied.");
  }

  // Host Hub welcome body — final coordinator-authored content (T3).
  // Unconditionally overwrites any placeholder; this is the authoritative copy.
  const updateWelcomeBodyFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_host_hub_welcome_body_v1'
  `).catch(() => []);

  if (updateWelcomeBodyFlag.length === 0) {
    await updateHostHubWelcomeBody(db);
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_host_hub_welcome_body_v1')`);
  } else {
    console.log("  ⏭ Host Hub welcome body already updated.");
  }

  // Manual chapter: host-first-week — "Your first week as a host".
  // New chapter for new hosts. Placed first in the host-team manual group
  // (manualGroups.ts). Covers right-after-joining, first-session prep,
  // during-and-after, the first month, and where to get help.
  const seedHostFirstWeekFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_manual_host_first_week_v1'
  `).catch(() => []);

  if (seedHostFirstWeekFlag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_manual_host_first_week_v1')`);
  } else {
    console.log("  ⏭ Manual host-first-week chapter already seeded.");
  }

  // Manual chapter: host-schedule (v3) — adds "For coordinators" section.
  // Appends three coordinator-specific subsections: member picker as situational
  // awareness tool, Rotations tab (coordinator-only), Reassign to me
  // (coordinator-only on covered sessions).
  const updateHostScheduleV3Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_schedule_v3'
  `).catch(() => []);

  if (updateHostScheduleV3Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_schedule_v3')`);
  } else {
    console.log("  ⏭ Manual host-schedule v3 already applied.");
  }

  // Manual chapter: host-schedule (v4) — adds "Your rotations" panel and
  // "Print my schedule" PDF export to the "What you see when you arrive"
  // section (session 109).
  const updateHostScheduleV4Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_schedule_v4'
  `).catch(() => []);

  if (updateHostScheduleV4Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_schedule_v4')`);
  } else {
    console.log("  ⏭ Manual host-schedule v4 already applied.");
  }

  // Host hub training document — sent to hosts before the May training session.
  // "Training Session — May 2026": what's changing, pre-reading links, agenda,
  // post-training steps, cutover timeline with [TBD] placeholders.
  const seedTrainingDocFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_host_hub_training_doc_v1'
  `).catch(() => []);

  if (seedTrainingDocFlag.length === 0) {
    await seedHostHubTrainingDoc(db);
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_host_hub_training_doc_v1')`);
  } else {
    console.log("  ⏭ Host hub training doc already seeded.");
  }

  // Session 100 cleanup: remove support inbox, site banner, drip, UserHubAccess,
  // MembershipType/UserMembership/AttendanceRecord scaffolding.
  // Idempotent — IF EXISTS guards prevent re-run errors.
  const session100CleanupFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'session_100_cleanup_v1'
  `).catch(() => []);

  if (session100CleanupFlag.length === 0) {
    console.log("  Running session 100 schema cleanup...");

    // Drop tables in dependency order (dependents first)
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS site_banner_dismissals CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS site_banners CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS drip_notifications CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS support_attachments CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS support_messages CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS support_notes CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS support_threads CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS support_signatures CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS support_templates CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS gmail_credentials CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS user_hub_access CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS user_memberships CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS membership_types CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS attendance_records CASCADE`);

    // Drop User columns
    await db.$executeRawUnsafe(`ALTER TABLE users DROP COLUMN IF EXISTS support_email_notifications`);
    await db.$executeRawUnsafe(`ALTER TABLE users DROP COLUMN IF EXISTS legacy_memberstack_id`);

    // Drop Course drip columns
    await db.$executeRawUnsafe(`ALTER TABLE courses DROP COLUMN IF EXISTS drip_enabled`);
    await db.$executeRawUnsafe(`ALTER TABLE courses DROP COLUMN IF EXISTS drip_interval_days`);
    await db.$executeRawUnsafe(`ALTER TABLE courses DROP COLUMN IF EXISTS hide_locked_lessons`);
    await db.$executeRawUnsafe(`ALTER TABLE courses DROP COLUMN IF EXISTS cohort_program_id`);

    // Drop Lesson drip columns
    await db.$executeRawUnsafe(`ALTER TABLE lessons DROP COLUMN IF EXISTS release_date`);
    await db.$executeRawUnsafe(`ALTER TABLE lessons DROP COLUMN IF EXISTS release_delay_days`);

    // Drop enum types (only once all referencing tables/columns are gone)
    await db.$executeRawUnsafe(`DROP TYPE IF EXISTS "SupportStatus" CASCADE`);
    await db.$executeRawUnsafe(`DROP TYPE IF EXISTS "AttendanceType" CASCADE`);
    await db.$executeRawUnsafe(`DROP TYPE IF EXISTS "AttendanceFormat" CASCADE`);

    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('session_100_cleanup_v1')`);
    console.log("  ✓ Session 100 cleanup complete.");
  } else {
    console.log("  ⏭ Session 100 cleanup already applied.");
  }

  // Manual chapter: host-schedule (v5) — adds "For virtual and hybrid sessions"
  // section explaining the "Enter room →" link on session rows (session 112).
  const updateHostScheduleV5Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_schedule_v5'
  `).catch(() => []);

  if (updateHostScheduleV5Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_schedule_v5')`);
  } else {
    console.log("  ⏭ Manual host-schedule v5 already applied.");
  }

  // Session 115 — placeholder welcomes for the three non-host operational
  // hubs (courses, registrar, support). Defensive: only writes welcomeBody
  // when it's currently null. Coordinator edits made before or after this
  // runs are preserved.
  const seedNonHostWelcomesFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_non_host_hub_home_content_v1'
  `).catch(() => []);

  if (seedNonHostWelcomesFlag.length === 0) {
    await seedNonHostHubHomeContent(db);
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('seed_non_host_hub_home_content_v1')`);
  } else {
    console.log("  ⏭ Non-host hub welcomes already seeded.");
  }

  // Manual chapter: host-hub-team-management v2 — replaces a one-line
  // reference to "request a magic link" with "request a sign-in code"
  // to match the session-119 auth change (2026-05-21). The
  // updateManualHostHubTeamManagement source file was edited in the
  // same commit; re-running it produces the corrected body.
  const updateManualTeamMgmtV2Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_hub_team_management_v2'
  `).catch(() => []);

  if (updateManualTeamMgmtV2Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_hub_team_management_v2')`);
  } else {
    console.log("  ⏭ Manual host-hub-team-management v2 already applied.");
  }

  // Manual chapter: course-hub v2 — full rewrite for the session-123
  // offering model build. Replaces the legacy 3-tier access description
  // with the orthogonal-flag model, four dana modes, categories CRUD,
  // and the eight-tab editor walkthrough. The v1 chapter (from
  // update-manual-course-hub.mjs) is kept in the file for historical
  // reference but is no longer wired — this v2 supersedes it.
  const updateManualCourseHubV2Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_course_hub_v2'
  `).catch(() => []);

  if (updateManualCourseHubV2Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_course_hub_v2')`);
  } else {
    console.log("  ⏭ Manual course-hub v2 already applied.");
  }

  // Manual chapter: host-session-room v6 — three role pills, widened
  // Co-host net, Bell mode + teacher-profile interaction. Source edits
  // are in update-manual-host-session-room.mjs; re-running the function
  // pushes the corrected body to the live DB row.
  const updateHostSessionRoomV6Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_session_room_v6'
  `).catch(() => []);

  if (updateHostSessionRoomV6Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_session_room_v6')`);
  } else {
    console.log("  ⏭ Manual host-session-room v6 already applied.");
  }

  // Manual chapter: host-session-room v7 (2026-05-26) — identity / capability
  // split landed: the Host pill is now identity-only (HostAssignment required,
  // no ADMIN bypass); End-for-All is a separate `hasEndAllAuthority` flag held
  // by Assigned Host + ADMIN + GUIDING_TEACHER + Teacher-when-no-host. The
  // "Co-host" pill was renamed to "Host Volunteer" (sangha-tone label). Share
  // Screen is now a Co-host capability across the board. The Reactions and
  // votes section was rewritten for the persistent ✓ / ✗ model + speaking
  // queue from the same session. Re-runs the upsert against the live DB row.
  const updateHostSessionRoomV7Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_session_room_v7'
  `).catch(() => []);

  if (updateHostSessionRoomV7Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_session_room_v7')`);
  } else {
    console.log("  ⏭ Manual host-session-room v7 already applied.");
  }

  // Session 126 — host-session-room chapter v8. Adds a paragraph to "Your room
  // opens early" explaining the time-gated session room (opens 22 min before
  // start, closes 30 min after end; calm 403 message outside the window;
  // ADMIN/GT bypass) and a paragraph announcing the per-session room policy
  // (every recurring program meeting opens a fresh room; chat starts clean;
  // forgot-to-End fallbacks make the carryover impossible). Re-runs the
  // upsert against the live DB row.
  const updateHostSessionRoomV8Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_session_room_v8'
  `).catch(() => []);

  if (updateHostSessionRoomV8Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_session_room_v8')`);
  } else {
    console.log("  ⏭ Manual host-session-room v8 already applied.");
  }

  // Session 127 — host-session-room chapter v9. Adds a one-line note to the
  // Role pills section + the Teacher pill paragraph noting that some
  // programs may show "Guide" / "Facilitator" / "Instructor" instead of
  // "Teacher" (per the new per-program teacherLabel field). The pill's
  // color and meaning don't change; only the label varies per program.
  const updateHostSessionRoomV9Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_session_room_v9'
  `).catch(() => []);

  if (updateHostSessionRoomV9Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_session_room_v9')`);
  } else {
    console.log("  ⏭ Manual host-session-room v9 already applied.");
  }

  // Session 133 — host-session-room chapter v10. Reflects the session-room UX
  // batch: join muted + camera off by default, device switching moved to
  // Settings (inline chevrons removed), Bell mode label fix (stable "Bell mode"
  // label + "On" marker, no longer flips to "Clean voice"), local Pin (hover →
  // Pin keeps a person as YOUR main view), screen share now fills the view with
  // a pre-share primer, private message by clicking a name in the roster,
  // unread-chat count on the Chat button, full names on tiles.
  const updateHostSessionRoomV10Flag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_manual_host_session_room_v10'
  `).catch(() => []);

  if (updateHostSessionRoomV10Flag.length === 0) {
    await db.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('update_manual_host_session_room_v10')`);
  } else {
    console.log("  ⏭ Manual host-session-room v10 already applied.");
  }

  // Session 124 — backfill ProgramTeacher rows for the five programs
  // where the named teacher has a real User account in the system.
  // The legacy Program.teacherFacilitators free-text field was the only
  // source of "who teaches this" before ProgramTeacher existed; the
  // session-79 introduction of ProgramTeacher only got applied to three
  // programs (Awakening The Heart, Day of Mindfulness, The Heart of
  // Wisdom). This migration brings the operational programs to parity.
  //
  // Effect on the room: a ProgramTeacher row makes the joining teacher's
  // tile carry the "Teacher" pill and puts them on the `teacher` audio
  // profile (no native noise suppression, no AGC, bell-friendly). Without
  // a row, even the teacher of the session lands on the speaker profile.
  //
  // Programs whose named teacher has no User account yet (Gina/Sam/Kerry/
  // Christine/Sara/etc.) are intentionally NOT migrated — their hosts
  // will continue on the speaker profile until they create accounts and
  // a coordinator adds them as ProgramTeacher. Peer-led silent sits and
  // service events stay teacher-less by design.
  //
  // Defensive: every assignment guards with findFirst → create so re-runs
  // are no-ops. Aborts cleanly if either user can't be resolved (probably
  // an email change worth investigating before rerunning).
  const backfillProgramTeachersFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'backfill_program_teachers_v1'
  `).catch(() => []);

  if (backfillProgramTeachersFlag.length === 0) {
    const jesse = await db.user.findFirst({
      where: { email: "jessefoy@icloud.com" },
      select: { id: true },
    });
    const maria = await db.user.findFirst({
      where: { email: "maria.sprecher@gothandgeek.com" },
      select: { id: true },
    });

    if (!jesse) {
      throw new Error(
        "backfill_program_teachers_v1: Jesse Foy user not found at jessefoy@icloud.com — update the email lookup or investigate before re-running.",
      );
    }
    if (!maria) {
      throw new Error(
        "backfill_program_teachers_v1: Maria Sprecher user not found at maria.sprecher@gothandgeek.com — update the email lookup or investigate before re-running.",
      );
    }

    const assignments = [
      { slug: "essential-dharma-study", userId: jesse.id, displayName: "Jesse" },
      { slug: "meditation-and-dharma-talk", userId: jesse.id, displayName: "Jesse" },
      { slug: "private-teacher-meetings", userId: jesse.id, displayName: "Jesse" },
      { slug: "the-art-of-meditation", userId: jesse.id, displayName: "Jesse" },
      { slug: "qigong-at-rim", userId: maria.id, displayName: "Maria" },
    ];

    for (const a of assignments) {
      const program = await db.program.findFirst({
        where: { slug: a.slug },
        select: { id: true },
      });
      if (!program) {
        console.log(`    ↪ skipped ${a.slug}: program not found in DB`);
        continue;
      }
      const existing = await db.programTeacher.findFirst({
        where: { programId: program.id, userId: a.userId },
        select: { id: true },
      });
      if (existing) {
        console.log(`    ⏭ ${a.slug}: ${a.displayName} already ProgramTeacher`);
        continue;
      }
      await db.programTeacher.create({
        data: { programId: program.id, userId: a.userId, order: 0 },
      });
      console.log(`    ✔ ${a.slug}: added ${a.displayName} as ProgramTeacher`);
    }

    // Ensure Maria's isTeacher flag is set so she appears in the public
    // teacher directory and in member-search results filtered to teachers.
    // Idempotent — update is a no-op if the value is already true.
    await db.user.update({
      where: { id: maria.id },
      data: { isTeacher: true },
    });
    console.log("    ✔ Maria Sprecher: isTeacher = true");

    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('backfill_program_teachers_v1')`,
    );
    console.log("  ✔ ProgramTeacher backfill applied.");
  } else {
    console.log("  ⏭ ProgramTeacher backfill already applied.");
  }

  // Session 127 — per-program teacherLabel. Adds a nullable String column to
  // Program so coordinators can override the "Teacher" pill on the session-
  // room participant tile per program ("Guide" for peer-led silent sits,
  // "Facilitator" for Recovery Dharma, "Instructor" for Qigong, custom for
  // anything else). Null = "Teacher" (the existing behavior). No backfill
  // needed — every existing row stays at null and continues to render as
  // "Teacher" until a coordinator sets the field. Pure additive change.
  const teacherLabelColumnFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'add_program_teacher_label'
  `).catch(() => []);

  if (teacherLabelColumnFlag.length === 0) {
    console.log("→ Adding Program.teacherLabel column…");
    await db.$executeRawUnsafe(
      `ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "teacherLabel" TEXT`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('add_program_teacher_label')`,
    );
    console.log("  ✔ Program.teacherLabel column added.");
  } else {
    console.log("  ⏭ Program.teacherLabel column already added.");
  }

  // Session 128 — Silent Meditation Hub architecture (Slice 1).
  // Three additive columns; no backfill. Pure structural additions:
  //   programs.hostingHubSlug   — null defaults to "host-team" at read time
  //   hubs.assignmentGrantsTeacher — false default; opt-in per hub
  //   hubs.teacherLabel         — null default; hub-level fallback for the pill label
  // Existing rows remain valid: every program reads as host-hosted (null), every
  // hub reads as non-teacher-granting (false). The new Silent Meditation hub is
  // created in Slice 2 via /admin/hubs with both fields explicitly set.
  const hostingHubSlugFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'add_program_hosting_hub_slug'
  `).catch(() => []);

  if (hostingHubSlugFlag.length === 0) {
    console.log("→ Adding Program.hostingHubSlug column…");
    await db.$executeRawUnsafe(
      `ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "hostingHubSlug" TEXT`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('add_program_hosting_hub_slug')`,
    );
    console.log("  ✔ Program.hostingHubSlug column added.");
  } else {
    console.log("  ⏭ Program.hostingHubSlug column already added.");
  }

  const hubTeacherCapabilityFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'add_hub_teacher_capability_fields'
  `).catch(() => []);

  if (hubTeacherCapabilityFlag.length === 0) {
    console.log("→ Adding Hub.assignmentGrantsTeacher + Hub.teacherLabel columns…");
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "assignmentGrantsTeacher" BOOLEAN NOT NULL DEFAULT false`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "teacherLabel" TEXT`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('add_hub_teacher_capability_fields')`,
    );
    console.log("  ✔ Hub.assignmentGrantsTeacher + Hub.teacherLabel columns added.");
  } else {
    console.log("  ⏭ Hub.assignmentGrantsTeacher + Hub.teacherLabel columns already added.");
  }

  // Manual chapter — Peer-Led Silent Meditation hub (Slice 2 manual deliverable).
  // Single chapter that explains the hub model, the claim flow, the Facilitator
  // pill semantics, and the sub-request etiquette.  Audience: members of the
  // peer-led-silent-meditation hub.  Idempotent via flag.
  const seedPeerLedSilentMeditationFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_manual_peer_led_silent_meditation_v1'
  `).catch(() => []);

  if (seedPeerLedSilentMeditationFlag.length === 0) {
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('seed_manual_peer_led_silent_meditation_v1')`,
    );
  } else {
    console.log("  ⏭ Manual peer-led-silent-meditation chapter already seeded.");
  }

  // Rename the Scheduler tool's default label from "Host Schedule" to
  // "Scheduler" (session 128 follow-up).  The registry name was historical —
  // when the tool only served the host team it made sense; now that
  // multiple hubs claim it, the generic name reads correctly in every
  // context.  We update existing HubAppLink rows that still carry the old
  // default; rows where a coordinator has manually customized the label
  // are left alone.
  const renameSchedulerFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'rename_scheduler_app_link_label_v1'
  `).catch(() => []);

  if (renameSchedulerFlag.length === 0) {
    const result = await db.hubAppLink.updateMany({
      where: { toolSlug: "schedule", label: "Host Schedule" },
      data: { label: "Scheduler" },
    });
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('rename_scheduler_app_link_label_v1')`,
    );
    console.log(`  ✔ Renamed ${result.count} Scheduler app-link label(s) from "Host Schedule" → "Scheduler".`);
  } else {
    console.log("  ⏭ Scheduler app-link label rename already applied.");
  }

  // Slice 2.5 — swap canonical CTA links for the {{*Button}} variables
  // shipped earlier in this slice.  Conservative: only replaces the body
  // when the canonical link pattern is present.  If a coordinator has
  // customized a template body so the canonical line is no longer there,
  // the migration logs a notice and leaves the body alone — they keep
  // their edit and can swap in the button variable manually via
  // /admin/emails when ready.  Variables array is always updated so the
  // new {{*Button}} variable shows in the admin UI variable list.
  const swapButtonsFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'swap_email_cta_to_buttons_v1'
  `).catch(() => []);

  if (swapButtonsFlag.length === 0) {
    // Each entry: slug, canonical line to replace, button variable to use,
    // and the canonical variable list with the new button variable added.
    const swaps = [
      {
        slug: "sub-request-posted",
        find: "**[Cover this session →]({{coverUrl}})**",
        replace: "{{coverButton}}",
        variables: ["firstName", "requesterName", "programName", "sessionDate", "message", "hubUrl", "coverUrl", "coverButton"],
      },
      {
        slug: "sub-request-claimed",
        find: "**[View the schedule →]({{hubUrl}})**",
        replace: "{{scheduleButton}}",
        variables: ["firstName", "claimerName", "programName", "sessionDate", "message", "hubUrl", "scheduleButton"],
      },
      {
        slug: "host-assignment-confirmation",
        find: "**[View the Host Schedule →]({{scheduleUrl}})**",
        replace: "{{scheduleButton}}",
        variables: ["firstName", "programName", "dateText", "requesterNote", "scheduleUrl", "scheduleButton"],
      },
      {
        slug: "host-assignment-removed",
        find: "**[View the Host Schedule →]({{scheduleUrl}})**",
        replace: "{{scheduleButton}}",
        variables: ["firstName", "programName", "dateText", "byName", "scheduleUrl", "scheduleButton"],
      },
      {
        slug: "new-program-needs-host",
        find: "**[View the schedule →]({{scheduleUrl}})**",
        replace: "{{scheduleButton}}",
        variables: ["firstName", "programName", "programFormat", "scheduleUrl", "scheduleButton"],
      },
      {
        slug: "hub-welcome",
        find: "**[Visit {{hubName}} →]({{hubUrl}})**",
        replace: "{{hubButton}}",
        variables: ["firstName", "hubName", "hubUrl", "hubButton"],
      },
    ];

    let bodyUpdates = 0;
    let varOnlyUpdates = 0;
    let skipped = 0;
    for (const swap of swaps) {
      const tmpl = await db.emailTemplate.findUnique({ where: { slug: swap.slug } });
      if (!tmpl) {
        console.log(`  ⚠ ${swap.slug}: template not found, skipping.`);
        continue;
      }
      const hasLine = typeof tmpl.body === "string" && tmpl.body.includes(swap.find);
      if (hasLine) {
        const newBody = tmpl.body.replace(swap.find, swap.replace);
        await db.emailTemplate.update({
          where: { slug: swap.slug },
          data: { body: newBody, variables: swap.variables },
        });
        bodyUpdates++;
      } else {
        // Body has been customized — leave it alone but still update the
        // variables array so the new button variable appears in the admin UI.
        await db.emailTemplate.update({
          where: { slug: swap.slug },
          data: { variables: swap.variables },
        });
        varOnlyUpdates++;
        console.log(`  ⚠ ${swap.slug}: body customized; variables updated, body left as-is. Paste ${swap.replace} via /admin/emails when ready.`);
      }
    }
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('swap_email_cta_to_buttons_v1')`,
    );
    console.log(`  ✔ Email CTA buttons: ${bodyUpdates} body+variable swap(s), ${varOnlyUpdates} variable-only update(s).`);
  } else {
    console.log("  ⏭ Email CTA button swap already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Session 129 — Auxiliary-hub coverage (AV + Greeter hubs).
  //
  // Generalizes Program ↔ Hub from the 1:1 `hostingHubSlug` model to a
  // many-to-many with a role dimension. A program retains one *primary*
  // hub (the existing `hostingHubSlug`) and may add auxiliary hubs that
  // schedule supporting roles — AV volunteer, greeters, future expansions.
  //
  // Schema changes (all additive; backfill is value-preserving):
  //   - hubs.allowsMultipleAssignments BOOLEAN DEFAULT false
  //   - hubs.appliesToFormats          TEXT[] DEFAULT ARRAY['virtual','hybrid']
  //   - host_assignments.hubSlug       TEXT DEFAULT 'host-team'
  //                                    (backfilled from programs.hostingHubSlug)
  //   - standing_assignments.hubSlug   TEXT DEFAULT 'host-team'
  //                                    (backfilled from programs.hostingHubSlug)
  //   - host_assignments unique constraint dropped (now (programSlug, sessionDate,
  //     hubSlug) tuple is allowed multiple times for multi-claimant hubs); a
  //     composite index replaces it
  //   - standing_assignments unique constraint widened to include hubSlug
  //   - new table program_coverage_hubs (programSlug, hubSlug)
  //
  // Existing rows: every HostAssignment lands on its program's hub. Existing
  // primary scheduling behavior is unchanged.
  // ───────────────────────────────────────────────────────────────────────
  const auxiliaryHubCoverageFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'auxiliary_hub_coverage_v1'
  `).catch(() => []);

  if (auxiliaryHubCoverageFlag.length === 0) {
    console.log("→ Auxiliary-hub coverage schema (session 129)…");

    // 1. Hub.allowsMultipleAssignments
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "allowsMultipleAssignments" BOOLEAN NOT NULL DEFAULT false`,
    );

    // 2. Hub.appliesToFormats — default preserves host-team / peer-led behavior.
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "appliesToFormats" TEXT[] NOT NULL DEFAULT ARRAY['virtual','hybrid']::TEXT[]`,
    );

    // 3. HostAssignment.hubSlug — additive column with safe default. Existing
    //    rows take "host-team" via the default; the backfill below moves
    //    rows belonging to programs that were transferred to a non-default
    //    hub (peer-led-silent-meditation) to their actual hub.
    await db.$executeRawUnsafe(
      `ALTER TABLE "host_assignments" ADD COLUMN IF NOT EXISTS "hubSlug" TEXT NOT NULL DEFAULT 'host-team'`,
    );

    // 4. Backfill HostAssignment.hubSlug from programs.hostingHubSlug. Only
    //    rows whose program has a non-null hostingHubSlug need updating;
    //    everyone else is already at "host-team" via the default.
    const haUpdate = await db.$executeRawUnsafe(`
      UPDATE "host_assignments" ha
      SET "hubSlug" = p."hostingHubSlug"
      FROM "programs" p
      WHERE ha."programSlug" = p."slug"
        AND p."hostingHubSlug" IS NOT NULL
        AND ha."hubSlug" = 'host-team'
    `);
    console.log(`  ✔ HostAssignment.hubSlug backfilled (${haUpdate} row(s) moved off default).`);

    // 5. StandingAssignment.hubSlug — same shape.
    await db.$executeRawUnsafe(
      `ALTER TABLE "standing_assignments" ADD COLUMN IF NOT EXISTS "hubSlug" TEXT NOT NULL DEFAULT 'host-team'`,
    );
    const saUpdate = await db.$executeRawUnsafe(`
      UPDATE "standing_assignments" sa
      SET "hubSlug" = p."hostingHubSlug"
      FROM "programs" p
      WHERE sa."programSlug" = p."slug"
        AND p."hostingHubSlug" IS NOT NULL
        AND sa."hubSlug" = 'host-team'
    `);
    console.log(`  ✔ StandingAssignment.hubSlug backfilled (${saUpdate} row(s) moved off default).`);

    // 6. Drop the old HostAssignment unique (programSlug, sessionDate). Two
    //    Prisma versions of Postgres produce two different constraint
    //    names; try both. Replaced by app-layer uniqueness enforcement
    //    (single-slot hubs check before insert) plus the composite index
    //    below for query performance.
    await db.$executeRawUnsafe(
      `ALTER TABLE "host_assignments" DROP CONSTRAINT IF EXISTS "host_assignments_programSlug_sessionDate_key"`,
    );
    await db.$executeRawUnsafe(
      `DROP INDEX IF EXISTS "host_assignments_programSlug_sessionDate_key"`,
    );
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "host_assignments_programSlug_sessionDate_hubSlug_idx"
       ON "host_assignments" ("programSlug", "sessionDate", "hubSlug")`,
    );
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "host_assignments_hubSlug_sessionDate_idx"
       ON "host_assignments" ("hubSlug", "sessionDate")`,
    );
    console.log("  ✔ HostAssignment uniqueness migrated to composite indexes.");

    // 7. Widen StandingAssignment unique to include hubSlug. Drop the
    //    old constraint (try both naming conventions); add the new one.
    await db.$executeRawUnsafe(
      `ALTER TABLE "standing_assignments" DROP CONSTRAINT IF EXISTS "standing_assignments_programSlug_dayOfWeek_occurrence_key"`,
    );
    await db.$executeRawUnsafe(
      `DROP INDEX IF EXISTS "standing_assignments_programSlug_dayOfWeek_occurrence_key"`,
    );
    await db.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "standing_assignments_programSlug_dayOfWeek_occurrence_hubSlug_key"
       ON "standing_assignments" ("programSlug", "dayOfWeek", "occurrence", "hubSlug")`,
    );
    console.log("  ✔ StandingAssignment unique widened to include hubSlug.");

    // 8. ProgramCoverageHub join table.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "program_coverage_hubs" (
        "programSlug" TEXT NOT NULL,
        "hubSlug"     TEXT NOT NULL,
        "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("programSlug", "hubSlug")
      )
    `);
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "program_coverage_hubs_hubSlug_idx" ON "program_coverage_hubs" ("hubSlug")`,
    );
    console.log("  ✔ program_coverage_hubs table ready.");

    // 9. Set appliesToFormats and allowsMultipleAssignments for the new
    //    in-person hubs if they exist. Idempotent — only updates when the
    //    hub is present. Safe to run before Jesse creates them too (no-op).
    //
    //    NOTE: do NOT set `hasSchedule: true` here. That flag carries a
    //    second meaning we don't want for AV / greeter — it routes the
    //    hub's Home view to `HostHubHomeClient` (host-team-specific,
    //    hardcoded "Our offerings this month" panel + /admin/manual/host-hub
    //    link). The session-129-fix migration step (next entry) walks
    //    this back if we accidentally set it on an earlier run.
    const avUpdate = await db.hub.updateMany({
      where: { slug: "audio-visual" },
      data: { appliesToFormats: ["in-person", "hybrid"], allowsMultipleAssignments: false },
    });
    const greeterUpdate = await db.hub.updateMany({
      where: { slug: "greeter" },
      data: { appliesToFormats: ["in-person", "hybrid"], allowsMultipleAssignments: true },
    });
    if (avUpdate.count > 0) console.log("  ✔ audio-visual hub configured (single-slot, in-person+hybrid).");
    if (greeterUpdate.count > 0) console.log("  ✔ greeter hub configured (multi-claimant, in-person+hybrid).");

    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('auxiliary_hub_coverage_v1')`,
    );
    console.log("  ✔ Auxiliary-hub coverage migration complete.");
  } else {
    console.log("  ⏭ Auxiliary-hub coverage already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Session 129 follow-up — set Hub.hasSchedule on peer-led-silent-meditation.
  //
  // The admin form at /admin/hubs never exposed `hasSchedule`, so the
  // peer-led-silent-meditation hub was created with the schema default
  // (false). That meant:
  //   - Its Home view routed to the generic HubHomeClient instead of
  //     HostHubHomeClient (the host-team-flavored view with "Our
  //     offerings this month")
  //   - It didn't appear in the ProgramEditor's Hosting team dropdown
  //     after the session-129 cleanup added a `hasSchedule` filter
  //
  // Fix: peer-led IS a hosting-style hub (runs live silent sit
  // sessions, owns LiveKit rooms, holds dharma authority). Set
  // hasSchedule=true so it gets the host-style Home view and is
  // selectable as a Hosting team. Idempotent — only updates if
  // currently false.
  // ───────────────────────────────────────────────────────────────────────
  const peerLedHasScheduleFixFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'peer_led_has_schedule_fix_v1'
  `).catch(() => []);

  if (peerLedHasScheduleFixFlag.length === 0) {
    console.log("→ Setting hasSchedule=true on peer-led-silent-meditation (session 129 follow-up)…");
    const fixed = await db.hub.updateMany({
      where: { slug: "peer-led-silent-meditation", hasSchedule: false },
      data: { hasSchedule: true },
    });
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('peer_led_has_schedule_fix_v1')`,
    );
    console.log(`  ✔ Fixed hasSchedule on ${fixed.count} hub(s).`);
  } else {
    console.log("  ⏭ peer-led-silent-meditation hasSchedule already fixed.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Session 129 follow-up — undo Hub.hasSchedule on AV + Greeter.
  //
  // The original session-129 migration set `hasSchedule: true` on
  // audio-visual + greeter so the ProgramEditor's Auxiliary coverage
  // fieldset would list them. But `hasSchedule` carries a second
  // meaning we didn't account for: it routes the hub's Home view to
  // `HostHubHomeClient` (host-team-specific UI, hardcoded
  // /admin/manual/host-hub link, "Our offerings this month" panel
  // that queries host-team data).
  //
  // The fix: separate the two concerns. `hasSchedule` stays narrow
  // ("host-style hub Home view") for host-team + peer-led-silent-
  // meditation. The ProgramEditor uses HubAppLink existence
  // (toolSlug = "schedule") as the authoritative "uses Scheduler"
  // signal instead.
  // ───────────────────────────────────────────────────────────────────────
  const auxHubHasScheduleFixFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'auxiliary_hub_has_schedule_fix_v1'
  `).catch(() => []);

  if (auxHubHasScheduleFixFlag.length === 0) {
    console.log("→ Walking back hub.hasSchedule on AV + Greeter (session 129 follow-up)…");
    const reverted = await db.hub.updateMany({
      where: { slug: { in: ["audio-visual", "greeter"] }, hasSchedule: true },
      data: { hasSchedule: false },
    });
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('auxiliary_hub_has_schedule_fix_v1')`,
    );
    console.log(`  ✔ Reverted hasSchedule on ${reverted.count} hub(s).`);
  } else {
    console.log("  ⏭ Hub.hasSchedule walk-back already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Session 130 follow-up — role-aware UI/email copy per hub.
  //
  // Each hub now carries three copy fields:
  //   coverageNoun   — "Host" / "AV" / "Greeter" / "Facilitator"
  //   coverageVerb   — "hosting" / "covering AV" / "greeting" / "facilitating"
  //   coverageAction — "host this" / "cover AV" / "greet" / "facilitate"
  //
  // Defaults match host-team so existing behavior carries through. This
  // migration backfills the three other configured hubs so copy is
  // role-accurate at first sight.
  // ───────────────────────────────────────────────────────────────────────
  const hubCoverageCopyFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'add_hub_coverage_copy_v1'
  `).catch(() => []);

  if (hubCoverageCopyFlag.length === 0) {
    console.log("→ Hub coverage copy (session 130 follow-up)…");

    // ALTER TABLE — additive columns with safe defaults. Idempotent.
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "coverageNoun" TEXT NOT NULL DEFAULT 'Host'`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "coverageVerb" TEXT NOT NULL DEFAULT 'hosting'`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "coverageAction" TEXT NOT NULL DEFAULT 'host this'`,
    );

    // Backfill role copy for the three non-host-team hubs.
    const peerLedUpdate = await db.hub.updateMany({
      where: { slug: "peer-led-silent-meditation" },
      data: {
        coverageNoun:   "Facilitator",
        coverageVerb:   "facilitating",
        coverageAction: "facilitate",
      },
    });
    const avUpdate = await db.hub.updateMany({
      where: { slug: "audio-visual" },
      data: {
        coverageNoun:   "AV",
        coverageVerb:   "covering AV",
        coverageAction: "cover AV",
      },
    });
    const greeterUpdate = await db.hub.updateMany({
      where: { slug: "greeter" },
      data: {
        coverageNoun:   "Greeter",
        coverageVerb:   "greeting",
        coverageAction: "greet",
      },
    });
    if (peerLedUpdate.count > 0) console.log("  ✔ peer-led-silent-meditation copy configured (Facilitator).");
    if (avUpdate.count > 0)      console.log("  ✔ audio-visual copy configured (AV).");
    if (greeterUpdate.count > 0) console.log("  ✔ greeter copy configured (Greeter).");

    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('add_hub_coverage_copy_v1')`,
    );
    console.log("  ✔ Hub coverage copy migration complete.");
  } else {
    console.log("  ⏭ Hub coverage copy already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Session 130 follow-up — heal orphan StandingAssignment + HostAssignment
  // rows whose `hubSlug` doesn't match the program's current `hostingHubSlug`.
  //
  // Root cause (Jesse's beta-test report): when a program was originally on
  // hub A, a rotation was set up there (StandingAssignment.hubSlug = A),
  // future HostAssignments were applied (hubSlug = A), and then the program
  // was transferred to hub B (Program.hostingHubSlug = B), the rotation rule
  // and its applied rows stayed on hub A. They become invisible in every UI
  // view: hub B's Rotations grid filters by hubSlug=B (doesn't show A's
  // rules); hub A's grid filters its program list by hostingHubSlug=A (this
  // program is no longer in hub A's list, so the rules don't render either).
  // But the apply-standing-assignments cron walks every rule regardless of
  // hub, so it keeps re-creating future HostAssignments from the orphan
  // rule. The coordinator clicks "Reset rotations" in hub B, the route
  // correctly clears hub B's rules — and the next morning the cron repopu-
  // lates from hub A's invisible orphan. From the coordinator's viewpoint
  // the reset "doesn't work."
  //
  // Heal strategy:
  //   1. Delete orphan StandingAssignment rules (and their open SubRequests
  //      from the future HostAssignments tied to them).
  //   2. Delete future orphan HostAssignment rows (sessionDate >= today CT).
  //      Past ones stay as historical record — they represent sessions
  //      already hosted; deleting them would erase community history.
  //   3. Log per-program counts so the deploy log shows exactly what was
  //      healed.
  //
  // Idempotent: re-runs find nothing because every program's standing
  // assignments now match its current hostingHubSlug. The migration flag
  // skips it on subsequent deploys anyway.
  // ───────────────────────────────────────────────────────────────────────
  const healOrphanFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'heal_orphan_standing_assignments_v1'
  `).catch(() => []);

  if (healOrphanFlag.length === 0) {
    console.log("→ Healing orphan StandingAssignment + HostAssignment rows (session 130)…");

    // Build the "valid hubs per program" map. A rotation/HostAssignment is
    // valid on any of: (a) the program's primary `hostingHubSlug`, or (b)
    // any hub listed in ProgramCoverageHub for that program (session 129
    // auxiliary coverage — AV team, greeter team, etc). Reviewer caught
    // this — without ProgramCoverageHub, every legitimate auxiliary
    // rotation would be classified as orphan and deleted.
    const allPrograms = await db.program.findMany({
      select: { slug: true, name: true, hostingHubSlug: true },
    });
    const allCoverage = await db.programCoverageHub.findMany({
      select: { programSlug: true, hubSlug: true },
    });
    const validHubsByProgram = new Map();
    for (const p of allPrograms) {
      validHubsByProgram.set(p.slug, new Set([p.hostingHubSlug ?? "host-team"]));
    }
    for (const c of allCoverage) {
      const set = validHubsByProgram.get(c.programSlug);
      if (set) set.add(c.hubSlug);
    }

    // Cutoff: "now" — anything strictly in the future is in scope for
    // deletion. Past + already-happened-today sessions stay as historical
    // record. Reviewer caught this — the earlier `setHours(0,0,0,0)`
    // pattern produces midnight-UTC-of-CT-date on Vercel which can include
    // sessions that already happened earlier today CT.
    const futureCutoff = new Date();

    function describeProgramHubs(programSlug) {
      const set = validHubsByProgram.get(programSlug);
      if (!set) return "(program deleted)";
      return [...set].sort().join(", ");
    }

    function isOrphan(programSlug, hubSlug) {
      const set = validHubsByProgram.get(programSlug);
      if (!set) return true; // program no longer exists
      return !set.has(hubSlug);
    }

    // ── 1. Find every StandingAssignment whose hubSlug isn't in the
    //       program's valid set (primary or any auxiliary coverage hub).
    const allRules = await db.standingAssignment.findMany({
      select: { id: true, programSlug: true, hubSlug: true, dayOfWeek: true, userId: true },
    });
    const orphanRules = allRules.filter((r) => isOrphan(r.programSlug, r.hubSlug));

    let phase1RulesDeleted = 0;
    let phase1AssnsDeleted = 0;

    if (orphanRules.length === 0) {
      console.log("  ✔ No orphan StandingAssignment rows found.");
    } else {
      // Group orphans by (programSlug, hubSlug) so the log is readable.
      const groups = new Map();
      for (const r of orphanRules) {
        const key = `${r.programSlug}::${r.hubSlug}`;
        if (!groups.has(key)) groups.set(key, { programSlug: r.programSlug, hubSlug: r.hubSlug, ids: [] });
        groups.get(key).ids.push(r.id);
      }
      console.log(`  Found ${orphanRules.length} orphan StandingAssignment row(s) across ${groups.size} (program, hub) bundles:`);
      for (const g of groups.values()) {
        console.log(`    - ${g.programSlug} · orphan-hub=${g.hubSlug} · valid-hubs=[${describeProgramHubs(g.programSlug)}] · ${g.ids.length} rule(s)`);
      }

      const orphanRuleIds = orphanRules.map((r) => r.id);

      // Transaction: SubClaim → SubRequest → HostAssignment → Standing-
      // Assignment. SubRequest.assignmentId FK is Restrict, so we MUST
      // delete SubRequest rows (not cancel) before deleting their parent
      // HostAssignments. SubClaim.subRequestId FK cascades on SubRequest
      // delete, but we delete SubClaim explicitly first for consistency
      // with /api/host/assignments/clear/route.ts (in-house pattern for
      // hub-scoped destructive cleanup). Reviewer caught this — the
      // previous version cancelled OPEN sub-requests only and would have
      // FK-violated on the very first CLAIMED or CANCELLED row.
      const txResult = await db.$transaction(async (tx) => {
        const futureAssns = await tx.hostAssignment.findMany({
          where: {
            standingAssignmentId: { in: orphanRuleIds },
            sessionDate: { gte: futureCutoff },
          },
          select: { id: true },
        });
        const futureAssnIds = futureAssns.map((a) => a.id);
        let assnsDeleted = 0;
        if (futureAssnIds.length > 0) {
          await tx.subClaim.deleteMany({
            where: { request: { assignmentId: { in: futureAssnIds } } },
          });
          await tx.subRequest.deleteMany({
            where: { assignmentId: { in: futureAssnIds } },
          });
          const delAssn = await tx.hostAssignment.deleteMany({
            where: { id: { in: futureAssnIds } },
          });
          assnsDeleted = delAssn.count;
        }
        // Delete the orphan rules themselves. Past HostAssignments
        // keep their historical record but lose their FK to the rule
        // (standingAssignmentId is SetNull-on-delete).
        const delRules = await tx.standingAssignment.deleteMany({
          where: { id: { in: orphanRuleIds } },
        });
        return { rulesDeleted: delRules.count, assnsDeleted };
      });
      phase1RulesDeleted = txResult.rulesDeleted;
      phase1AssnsDeleted = txResult.assnsDeleted;
      console.log(`  ✔ Deleted ${phase1AssnsDeleted} future HostAssignment row(s) tied to orphan rules.`);
      console.log(`  ✔ Deleted ${phase1RulesDeleted} orphan StandingAssignment rule(s).`);
    }

    // ── 2. Also heal any orphan future HostAssignment rows that aren't
    //       tied to a rule (created via direct claim before the program
    //       transferred hubs, or whose rule was independently deleted
    //       earlier and standingAssignmentId got SetNull'd).
    const allFutureAssns = await db.hostAssignment.findMany({
      where: {
        sessionDate: { gte: futureCutoff },
        standingAssignmentId: null,
      },
      select: { id: true, programSlug: true, hubSlug: true },
    });
    const orphanAssns = allFutureAssns.filter((a) => isOrphan(a.programSlug, a.hubSlug));

    let phase2AssnsDeleted = 0;

    if (orphanAssns.length === 0) {
      console.log("  ✔ No orphan (non-rotation) future HostAssignment rows found.");
    } else {
      console.log(`  Found ${orphanAssns.length} orphan future HostAssignment row(s) not tied to a rotation rule.`);
      const orphanAssnIds = orphanAssns.map((a) => a.id);
      const tx2Result = await db.$transaction(async (tx) => {
        await tx.subClaim.deleteMany({
          where: { request: { assignmentId: { in: orphanAssnIds } } },
        });
        await tx.subRequest.deleteMany({
          where: { assignmentId: { in: orphanAssnIds } },
        });
        const delAssn = await tx.hostAssignment.deleteMany({
          where: { id: { in: orphanAssnIds } },
        });
        return { assnsDeleted: delAssn.count };
      });
      phase2AssnsDeleted = tx2Result.assnsDeleted;
      console.log(`  ✔ Deleted ${phase2AssnsDeleted} orphan HostAssignment row(s).`);
    }

    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('heal_orphan_standing_assignments_v1')`,
    );
    console.log(
      `  ✔ Orphan-row heal complete. Totals: ${phase1RulesDeleted} rule(s), ${phase1AssnsDeleted + phase2AssnsDeleted} future assignment(s) deleted.`,
    );
  } else {
    console.log("  ⏭ Orphan-row heal already applied.");
  }

  // ────────────────────────────────────────────────────────────────────────
  // Backfill: every HOST / HOST_MANAGER → a host-team HubMember row (session
  // 146). syncHubMembership creates these on role-grant going forward; this
  // covers any legacy role-only hosts who never got a row. REQUIRED before the
  // membership-orphan heal below — without it, a role-only host's legitimate
  // host-team assignments would be misread as orphans and deleted. Mirrors
  // syncHubMembership's create shape (only sync-owned fields set; schema
  // defaults govern status / hostingCapability / communicationsEnabled).
  // Idempotent: skips users who already have a row; flag-guarded regardless.
  // ────────────────────────────────────────────────────────────────────────
  const backfillHostMembershipFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'backfill_host_team_membership_v1'
  `).catch(() => []);

  if (backfillHostMembershipFlag.length === 0) {
    console.log("→ Backfilling host-team HubMember rows for HOST / HOST_MANAGER (session 146)…");
    const hostTeam = await db.hub.findUnique({ where: { slug: "host-team" }, select: { id: true } });
    if (!hostTeam) {
      console.log("  ⏭ host-team hub not found — skipping backfill.");
    } else {
      const hostUsers = await db.user.findMany({
        where: { roles: { hasSome: ["HOST", "HOST_MANAGER"] } },
        select: { id: true, roles: true },
      });
      const existing = await db.hubMember.findMany({
        where: { hubId: hostTeam.id, userId: { in: hostUsers.map((u) => u.id) } },
        select: { userId: true },
      });
      const haveRow = new Set(existing.map((m) => m.userId));
      let created = 0;
      for (const u of hostUsers) {
        if (haveRow.has(u.id)) continue;
        const isCoord = u.roles.includes("HOST_MANAGER");
        await db.hubMember.create({
          data: {
            hubId: hostTeam.id,
            userId: u.id,
            position: isCoord ? "Host Coordinator" : "Host",
            isCoordinator: isCoord,
          },
        });
        created++;
      }
      console.log(
        `  ✔ Backfill complete. Created ${created} host-team membership row(s) (${hostUsers.length - created} already present).`,
      );
    }
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('backfill_host_team_membership_v1')`,
    );
  } else {
    console.log("  ⏭ host-team membership backfill already applied.");
  }

  // ────────────────────────────────────────────────────────────────────────
  // One-time heal: remove "covers but not a member" orphans (session 146).
  // An assignment/rotation is an orphan when its (userId, hubSlug) has NO
  // HubMember row for that hub — the person shows as covering a session but
  // isn't on that team's roster (the "Nancy" symptom). Likely causes: a member
  // hard-removed while assignments remained; a global-role holder assigned in a
  // hub they never joined; legacy import. Going forward it can't recur:
  // member-removal now cleans up (covers-⇒-member at the DELETE), the create
  // path requires membership, and the apply cron filters non-members.
  //
  // Heals FUTURE rows only — past assignments stay as historical record. Logs
  // every orphan it removes (name · hub · program · date) so the deploy log is
  // the audit trail (prod isn't reachable from the dev sandbox). MUST run after
  // backfill_host_team_membership_v1 so role-only hosts aren't misread as
  // orphans. FK-safe deletes: SubClaim → SubRequest → HostAssignment.
  // ────────────────────────────────────────────────────────────────────────
  const healMembershipFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'heal_membership_orphan_assignments_v1'
  `).catch(() => []);

  if (healMembershipFlag.length === 0) {
    console.log("→ Healing membership-orphan HostAssignment + StandingAssignment rows (session 146)…");

    // Membership set: "hubSlug::userId" for every HubMember row.
    const allHubs = await db.hub.findMany({ select: { id: true, slug: true } });
    const slugByHubId = new Map(allHubs.map((h) => [h.id, h.slug]));
    const allMembers = await db.hubMember.findMany({ select: { hubId: true, userId: true } });
    const memberKeys = new Set(
      allMembers.map((m) => `${slugByHubId.get(m.hubId) ?? ""}::${m.userId}`),
    );
    const isOrphan = (hubSlug, userId) => !!userId && !memberKeys.has(`${hubSlug}::${userId}`);

    const futureCutoff = new Date();

    // 1. Orphan FUTURE HostAssignment rows (rule-derived or manual).
    const futureAssns = await db.hostAssignment.findMany({
      where: { sessionDate: { gte: futureCutoff }, userId: { not: null } },
      select: {
        id: true, userId: true, hubSlug: true, programSlug: true, sessionDate: true,
        user: { select: { firstName: true, lastName: true, preferredName: true } },
      },
    });
    const orphanAssns = futureAssns.filter((a) => isOrphan(a.hubSlug, a.userId));

    let assnsDeleted = 0;
    if (orphanAssns.length === 0) {
      console.log("  ✔ No membership-orphan future HostAssignment rows found.");
    } else {
      console.log(`  Found ${orphanAssns.length} membership-orphan future HostAssignment row(s):`);
      for (const a of orphanAssns) {
        const name =
          a.user?.preferredName ||
          [a.user?.firstName, a.user?.lastName].filter(Boolean).join(" ") ||
          a.userId;
        const date = a.sessionDate ? a.sessionDate.toISOString().slice(0, 10) : "(no date)";
        console.log(`    - ${name} · hub=${a.hubSlug} · ${a.programSlug} · ${date}`);
      }
      const ids = orphanAssns.map((a) => a.id);
      assnsDeleted = await db.$transaction(async (tx) => {
        await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: ids } } } });
        await tx.subRequest.deleteMany({ where: { assignmentId: { in: ids } } });
        const d = await tx.hostAssignment.deleteMany({ where: { id: { in: ids } } });
        return d.count;
      });
      console.log(`  ✔ Deleted ${assnsDeleted} membership-orphan HostAssignment row(s).`);
    }

    // 2. Orphan StandingAssignment rules (so the cron stops re-applying them).
    const allRules = await db.standingAssignment.findMany({
      select: { id: true, userId: true, hubSlug: true, programSlug: true, dayOfWeek: true },
    });
    const orphanRules = allRules.filter((r) => isOrphan(r.hubSlug, r.userId));

    let rulesDeleted = 0;
    if (orphanRules.length === 0) {
      console.log("  ✔ No membership-orphan StandingAssignment rules found.");
    } else {
      console.log(`  Found ${orphanRules.length} membership-orphan StandingAssignment rule(s):`);
      for (const r of orphanRules) {
        console.log(`    - user=${r.userId} · hub=${r.hubSlug} · ${r.programSlug} · ${r.dayOfWeek ?? "(no day)"}`);
      }
      const del = await db.standingAssignment.deleteMany({
        where: { id: { in: orphanRules.map((r) => r.id) } },
      });
      rulesDeleted = del.count;
      console.log(`  ✔ Deleted ${rulesDeleted} membership-orphan StandingAssignment rule(s).`);
    }

    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('heal_membership_orphan_assignments_v1')`,
    );
    console.log(
      `  ✔ Membership-orphan heal complete. Totals: ${assnsDeleted} assignment(s), ${rulesDeleted} rule(s) deleted.`,
    );
  } else {
    console.log("  ⏭ Membership-orphan heal already applied.");
  }

  // ────────────────────────────────────────────────────────────────────────
  // Rate-limit table (defense-in-depth for NextAuth signin + callback).
  // Idempotent: CREATE TABLE IF NOT EXISTS; flag prevents log noise on
  // re-runs.
  // ────────────────────────────────────────────────────────────────────────
  const rateLimitFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'rate_limit_windows_v1'
  `).catch(() => []);

  if (rateLimitFlag.length === 0) {
    console.log("→ Rate-limit windows table…");
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "rate_limit_windows" (
        "id"          TEXT PRIMARY KEY,
        "key"         TEXT NOT NULL UNIQUE,
        "count"       INTEGER NOT NULL DEFAULT 0,
        "windowStart" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "expiresAt"   TIMESTAMPTZ NOT NULL
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "rate_limit_windows_expiresAt_idx"
        ON "rate_limit_windows" ("expiresAt")
    `);
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('rate_limit_windows_v1')`,
    );
    console.log("  ✔ rate_limit_windows table ready.");
  } else {
    console.log("  ⏭ rate_limit_windows table already applied.");
  }

  // ────────────────────────────────────────────────────────────────────────
  // Session bans table — "Remove for the rest of this session" in the
  // session room (host control). Per-roomName rows; bans expire naturally
  // with the per-day room name. Idempotent: CREATE TABLE IF NOT EXISTS.
  // ────────────────────────────────────────────────────────────────────────
  const sessionBansFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'session_bans_v1'
  `).catch(() => []);

  if (sessionBansFlag.length === 0) {
    console.log("→ Session bans table…");
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "session_bans" (
        "id"         TEXT PRIMARY KEY,
        "roomName"   TEXT NOT NULL,
        "identity"   TEXT NOT NULL,
        "name"       TEXT,
        "bannedById" TEXT NOT NULL,
        "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "session_bans_roomName_idx"
        ON "session_bans" ("roomName")
    `);
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('session_bans_v1')`,
    );
    console.log("  ✔ session_bans table ready.");
  } else {
    console.log("  ⏭ session_bans table already applied.");
  }

  // ────────────────────────────────────────────────────────────────────────
  // Seed the "join-welcome" email template (sent alongside the sign-in code
  // when a new member completes the /join threshold). Defensive
  // findUnique → create per CLAUDE.md Email Template Gate — preserves any
  // admin edits made via /admin/emails on re-run.
  // ────────────────────────────────────────────────────────────────────────
  const joinWelcomeFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_join_welcome_email_template_v1'
  `).catch(() => []);

  if (joinWelcomeFlag.length === 0) {
    console.log("→ Seeding join-welcome email template…");

    const JOIN_WELCOME_BODY = `## Welcome, {{firstName}}.

We're so glad you've joined our community.

Whether you're new to meditation or have been practicing for years, our hope is that RIM becomes a place where you feel held — by the teachings, by the practice, and by the people walking this path alongside you.

There's no rush to do anything in particular. The community is here when you're ready.

### A few things to know

**Online sessions every morning and evening.** Most of our offerings are drop-ins — no registration needed. You'll find them on your dashboard.

**Programs and courses.** Structured learning, dharma study, qigong, meditation foundations. Some run as series; some are one-offs. Browse what's on at your own pace.

**Dana.** RIM is 100% community-funded. We don't charge fixed fees — we ask that you contribute in a way that feels right to you. That practice of generosity is part of what makes this community possible. There's no pressure and no right amount.

**Questions, anytime.** If something feels confusing, or you'd just like to say hello, write to us at [{{supportEmail}}](mailto:{{supportEmail}}). A real person will write back.

Over the next little while, you'll also receive a short series of welcome notes — a gentle orientation to the community and the practice. Take them at your pace.

{{{dashboardButton}}}

With care,
Rooted In Mindfulness
Brookfield, Wisconsin`;

    const existing = await db.emailTemplate.findUnique({
      where: { slug: "join-welcome" },
    });
    if (!existing) {
      await db.emailTemplate.create({
        data: {
          slug: "join-welcome",
          name: "Join — Community Welcome Letter",
          description:
            "Sent immediately when a new member completes the /join threshold. Lands alongside the sign-in code; the code is the door, this is the embrace.",
          enabled: true,
          subject: "Welcome to Rooted In Mindfulness, {{firstName}}",
          variables: ["firstName", "dashboardButton", "dashboardUrl", "supportEmail"],
          group: "01-auth",
          groupLabel: "Sign-in & Authentication",
          helpText:
            "Sent once, immediately, when a new member completes the /join page (name + email + community agreements). Distinct from the sign-in code email — the code is short and functional; this letter is the warm welcome that lands alongside it.\n\n" +
            "Available variables: {{firstName}}, {{dashboardButton}} (canonical RIM-blue button — use triple braces {{{dashboardButton}}} to render the HTML), {{dashboardUrl}} (plain URL fallback), {{supportEmail}}.\n\n" +
            "Safe to edit: subject, greeting, body copy, the closing signature. Free to rewrite this entirely in your own voice — it's the first email of the community arc.",
          body: JOIN_WELCOME_BODY,
        },
      });
      console.log("  ✔ join-welcome template created.");
    } else {
      console.log("  ⏭ join-welcome template already exists; preserving admin edits.");
    }

    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('seed_join_welcome_email_template_v1')`,
    );
  } else {
    console.log("  ⏭ join-welcome template seed already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // "No host needed" — Program.hostingRequired (self-led / community-led)
  //
  // Additive boolean column, default true so every existing program keeps
  // needing host coverage exactly as before. When set false via the editor,
  // the program is excluded from the Scheduler, rotation generation, and the
  // new-program-needs-host email (used for Recovery Dharma, drop-in community
  // groups, etc. that run themselves). Raw SQL references the @@map table name
  // "programs".
  // ───────────────────────────────────────────────────────────────────────
  const hostingRequiredFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'program_hosting_required_v1'
  `).catch(() => []);

  if (hostingRequiredFlag.length === 0) {
    console.log("→ Program.hostingRequired column (No host needed)…");
    await db.$executeRawUnsafe(
      `ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "hostingRequired" BOOLEAN NOT NULL DEFAULT true`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('program_hosting_required_v1')`,
    );
    console.log("  ✔ programs.hostingRequired ready (default true).");
  } else {
    console.log("  ⏭ program_hosting_required_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Session 143 — User.hostWelcomeSeenAt (first-login host recognition panel)
  //
  // Additive nullable timestamp. Null = the one-time "you're set up to host"
  // dashboard panel hasn't been acknowledged yet; set on dismiss/follow so the
  // recognition shows only until the member has seen it. Defaults to null for
  // every existing row (existing hosts see the panel once on their next visit,
  // by design — confirmed with Jesse, session 143). Raw SQL references the
  // @@map table name "users"; TIMESTAMP(3) matches Prisma's DateTime mapping.
  // ───────────────────────────────────────────────────────────────────────
  const hostWelcomeFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'user_host_welcome_seen_v1'
  `).catch(() => []);

  if (hostWelcomeFlag.length === 0) {
    console.log("→ User.hostWelcomeSeenAt column (host welcome panel)…");
    await db.$executeRawUnsafe(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hostWelcomeSeenAt" TIMESTAMP(3)`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('user_host_welcome_seen_v1')`,
    );
    console.log("  ✔ users.hostWelcomeSeenAt ready.");
  } else {
    console.log("  ⏭ user_host_welcome_seen_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Session 143 — userId indexes on host_assignments + standing_assignments
  //
  // Both tables filter by userId on the hot dashboard path (the host-welcome
  // "any hosting for this member?" lookup + the existing today-host query) but
  // were indexed only by (programSlug,…) / the unique tuple, so a userId filter
  // fell back to a seq scan. Additive, idempotent; Prisma-convention index
  // names so the schema and DB don't drift. Raw SQL uses @@map table names.
  // ───────────────────────────────────────────────────────────────────────
  const hostUserIdxFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'host_assignment_user_indexes_v1'
  `).catch(() => []);

  if (hostUserIdxFlag.length === 0) {
    console.log("→ userId indexes on host/standing assignments…");
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "host_assignments_userId_idx" ON "host_assignments"("userId")`,
    );
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "standing_assignments_userId_idx" ON "standing_assignments"("userId")`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('host_assignment_user_indexes_v1')`,
    );
    console.log("  ✔ userId indexes ready.");
  } else {
    console.log("  ⏭ host_assignment_user_indexes_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Member migration — User.isLegacyUnclaimed (quiet-pool marker)
  //
  // Additive boolean, default false so every existing real member is untouched
  // and correctly excluded from the legacy pool. Set true ONLY by the one-time
  // Memberstack import script (prisma/import-memberstack-members.mjs) for
  // accounts that haven't claimed themselves yet; cleared back to false the
  // moment they cross the agreement gate on first login (promotion). Drives the
  // cleanup-cron exemption (a bare import with no role/hub is never swept) and
  // the /admin/members default-hide filter (so ~1,000 imports don't flood the
  // registry). No index: the registry is admin-only, the table is ~hundreds–low
  // thousands of rows, and a boolean index has poor selectivity — the
  // server-side WHERE solves the only real concern (client payload size). Raw
  // SQL references the @@map table name "users".
  // ───────────────────────────────────────────────────────────────────────
  const legacyUnclaimedFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'user_is_legacy_unclaimed_v1'
  `).catch(() => []);

  if (legacyUnclaimedFlag.length === 0) {
    console.log("→ User.isLegacyUnclaimed column (legacy migration quiet pool)…");
    await db.$executeRawUnsafe(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isLegacyUnclaimed" BOOLEAN NOT NULL DEFAULT false`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('user_is_legacy_unclaimed_v1')`,
    );
    console.log("  ✔ users.isLegacyUnclaimed ready (default false).");
  } else {
    console.log("  ⏭ user_is_legacy_unclaimed_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Member migration — welcome-back email template (Email Template Gate)
  //
  // Sent once, via after(), when a migrated legacy member crosses the agreement
  // gate on first login (promotion). The returning-member counterpart of
  // join-welcome: shorter, acknowledges the rebuilt home, explains the
  // passwordless code (useful for people used to the old password), reassures
  // on dana. NOT pre-threshold-gated — by the time it fires the member has just
  // verified + consented, so it must reach them. findUnique → create preserves
  // any admin edits made via /admin/emails on re-run.
  // ───────────────────────────────────────────────────────────────────────
  const welcomeBackFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'seed_welcome_back_email_template_v1'
  `).catch(() => []);

  if (welcomeBackFlag.length === 0) {
    console.log("→ Seeding welcome-back email template…");

    const WELCOME_BACK_BODY = `## Welcome back, {{firstName}}.

It's good to see you again. We've rebuilt our online home from the ground up, and your place in the community carried over — you're already a member here, nothing to sign up for again.

A few things have moved, but nothing important has changed. Your dashboard is where you'll find the day's sessions, the programs and courses you can join, and everything else, in one calm place.

**Signing in.** There are no passwords here. Whenever you'd like to come in, we send a short code to your email — nothing to remember, nothing to forget.

**Still community-funded.** RIM continues to run entirely on dana — your generosity, offered freely. Nothing about that has changed.

If anything looks unfamiliar, or you'd just like to say hello, write to us at [{{supportEmail}}](mailto:{{supportEmail}}). A real person will write back.

{{{dashboardButton}}}

With care,
Rooted In Mindfulness
Brookfield, Wisconsin`;

    const existingWelcomeBack = await db.emailTemplate.findUnique({
      where: { slug: "welcome-back" },
    });
    if (!existingWelcomeBack) {
      await db.emailTemplate.create({
        data: {
          slug: "welcome-back",
          name: "Welcome Back — Returning Member Letter",
          description:
            "Sent once when a migrated legacy member (from the old Webflow/Memberstack site) crosses the agreement gate on first login to the new platform. The returning-member counterpart of join-welcome.",
          enabled: true,
          subject: "Welcome back to Rooted In Mindfulness, {{firstName}}",
          variables: ["firstName", "dashboardButton", "dashboardUrl", "supportEmail"],
          group: "01-auth",
          groupLabel: "Sign-in & Authentication",
          helpText:
            "Sent once, immediately, when a returning member from the old site logs in for the first time and accepts the Community Care Agreement (their 'promotion' into the new platform). Distinct from join-welcome (new members) and the sign-in code email.\n\n" +
            "Available variables: {{firstName}}, {{dashboardButton}} (canonical RIM-blue button — use triple braces {{{dashboardButton}}} to render the HTML), {{dashboardUrl}} (plain URL fallback), {{supportEmail}}.\n\n" +
            "Safe to edit: subject, greeting, body copy, the closing signature. Free to rewrite this entirely in your own voice — it's the first email of the returning-member arc.",
          body: WELCOME_BACK_BODY,
        },
      });
      console.log("  ✔ welcome-back template created.");
    } else {
      console.log("  ⏭ welcome-back template already exists; preserving admin edits.");
    }

    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('seed_welcome_back_email_template_v1')`,
    );
  } else {
    console.log("  ⏭ welcome-back template seed already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // One-time — normalize broken member name casing (legacy + current).
  //
  // Mirrors lib/nameCase.ts::toProperName. Only re-cases names that are
  // entirely UPPER or entirely lower (the clearly-accidental ones); intentional
  // mixed-case names (McDonald, DeShawn, van der Berg) are left as typed.
  // Hyphens + apostrophes title-cased. Logs every before→after as an audit
  // trail; flag-guarded so it runs once. Known imperfections left for hand-fix:
  // all-caps Mc/Mac (MCDONALD → Mcdonald) + 2-letter initials (TJ → Tj).
  // ───────────────────────────────────────────────────────────────────────
  const nameCaseFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'normalize_user_names_v1'
  `).catch(() => []);

  if (nameCaseFlag.length === 0) {
    console.log("→ Normalizing member name casing…");
    const toProperName = (raw) => {
      const s = (raw ?? "").replace(/\s+/g, " ").trim();
      if (!s) return s;
      const letters = s.replace(/[^\p{L}]/gu, "");
      if (!letters) return s;
      const isAllUpper = letters === letters.toUpperCase() && letters !== letters.toLowerCase();
      const isAllLower = letters === letters.toLowerCase() && letters !== letters.toUpperCase();
      if (!isAllUpper && !isAllLower) return s;
      return s.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase());
    };
    const allUsers = await db.user.findMany({
      select: { id: true, firstName: true, lastName: true },
    });
    let nameChanged = 0;
    for (const u of allUsers) {
      const fn = u.firstName == null ? u.firstName : toProperName(u.firstName);
      const ln = u.lastName == null ? u.lastName : toProperName(u.lastName);
      if (fn !== u.firstName || ln !== u.lastName) {
        await db.user.update({ where: { id: u.id }, data: { firstName: fn, lastName: ln } });
        console.log(`  [name] "${u.firstName ?? ""} ${u.lastName ?? ""}" → "${fn ?? ""} ${ln ?? ""}"`);
        nameChanged++;
      }
    }
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('normalize_user_names_v1')`,
    );
    console.log(`  ✔ normalized ${nameChanged} member name(s).`);
  } else {
    console.log("  ⏭ normalize_user_names_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Hub terminology — make the shared coverage emails hub-neutral so AV /
  // greeter / future scheduler hubs don't read "host" when an assignment or
  // sub email reaches them. Confirmation / removed / sub-claimed go generic
  // ("confirmed for", "to someone else", "your session", button CTA);
  // new-program-needs-host gains {{coverageNoun}} so it reads "may need AV
  // coverage". Intentional template update (Jesse's consent, session 145) —
  // overwrites these four bodies via updateMany (no-op if a row is absent).
  // ───────────────────────────────────────────────────────────────────────
  const coverageEmailFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'update_coverage_email_copy_v1'
  `).catch(() => []);

  if (coverageEmailFlag.length === 0) {
    console.log("→ Hub-neutralizing shared coverage email copy…");

    const cc1 = await db.emailTemplate.updateMany({
      where: { slug: "host-assignment-confirmation" },
      data: {
        subject: "You're confirmed for {{programName}}{{#if dateText}} — {{dateText}}{{/if}}",
        variables: ["firstName", "programName", "dateText", "requesterNote", "scheduleUrl", "scheduleButton"],
        body: `Hi {{firstName}},

You're confirmed for **{{programName}}**{{#if dateText}} on {{dateText}}{{/if}}. Thank you.

{{#if requesterNote}}
> {{requesterNote}}
{{/if}}

{{{scheduleButton}}}

If anything changes and you need coverage, you can request a sub from the schedule.

---
Rooted In Mindfulness · Brookfield, WI`,
      },
    });
    console.log(`  ✔ host-assignment-confirmation (${cc1.count})`);

    const cc2 = await db.emailTemplate.updateMany({
      where: { slug: "host-assignment-removed" },
      data: {
        subject: "You're no longer scheduled for {{programName}}{{#if dateText}} on {{dateText}}{{/if}}",
        variables: ["firstName", "programName", "dateText", "byName", "scheduleUrl", "scheduleButton"],
        body: `Hi {{firstName}},

**{{byName}}** has reassigned **{{programName}}**{{#if dateText}} on {{dateText}}{{/if}} to someone else — you're no longer scheduled for this session.

If you have questions about this change, please reach out to your coordinator.

{{{scheduleButton}}}

---
Rooted In Mindfulness · Brookfield, WI`,
      },
    });
    console.log(`  ✔ host-assignment-removed (${cc2.count})`);

    const cc3 = await db.emailTemplate.updateMany({
      where: { slug: "sub-request-claimed" },
      data: {
        variables: ["firstName", "claimerName", "programName", "sessionDate", "message", "hubUrl", "scheduleButton"],
        body: `Hi {{firstName}},

Good news — **{{claimerName}}** has agreed to cover your session for **{{programName}}**{{sessionDate}}.

{{#if message}}
> {{message}}
{{/if}}

You're off the hook for this one. Thank you for letting the team know early.

{{{scheduleButton}}}

---
Rooted In Mindfulness · Brookfield, WI`,
      },
    });
    console.log(`  ✔ sub-request-claimed (${cc3.count})`);

    const cc4 = await db.emailTemplate.updateMany({
      where: { slug: "new-program-needs-host" },
      data: {
        variables: ["firstName", "programName", "programFormat", "coverageNoun", "scheduleUrl", "scheduleButton"],
        body: `{{#if firstName}}Hi {{firstName}},{{else}}Hello,{{/if}}

A new program has just been added: **{{programName}}** ({{programFormat}}). It may need **{{coverageNoun}}** coverage on its upcoming sessions.

If you'd like to take one, you can sign up on the schedule.

{{{scheduleButton}}}

---
Rooted In Mindfulness · Brookfield, WI`,
      },
    });
    console.log(`  ✔ new-program-needs-host (${cc4.count})`);

    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('update_coverage_email_copy_v1')`,
    );
    console.log("  ✔ coverage email copy hub-neutralized.");
  } else {
    console.log("  ⏭ update_coverage_email_copy_v1 already applied.");
  }

  // ── Retire the plain HOST role (session 153) ──────────────────────────────
  // host-team membership is now the source of truth for being a host (set via
  // the Member Registry "Hub memberships" tool). The plain HOST role left the
  // UI; strip it from existing users so its capability *fallback* can't outlive
  // a host-team removal (remove-from-Teams must actually remove). Ensure each
  // holder keeps host-team membership FIRST, so no one loses hosting in the
  // switch. HOST_MANAGER (cross-hub scheduling power) is intentionally untouched.
  const retireHostFlag = await db.$queryRawUnsafe(
    `SELECT name FROM "_migration_flags" WHERE name = 'retire_host_role_v1'`,
  );
  if (retireHostFlag.length === 0) {
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "_migration_flags" (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`,
    );
    const hostHub = await db.hub.findUnique({ where: { slug: "host-team" }, select: { id: true } });
    if (!hostHub) {
      // Never strip without a landing spot — retry on a future deploy (flag unset).
      console.warn("  ⚠ retire_host_role_v1 skipped: host-team hub not found; will retry next deploy.");
    } else {
      const hostRoleUsers = await db.user.findMany({
        where: { roles: { has: "HOST" } },
        select: { id: true, roles: true },
      });
      for (const u of hostRoleUsers) {
        // Ensure host-team membership BEFORE stripping the role, so capability
        // (which reads membership first) never lapses in the switch.
        await db.hubMember.upsert({
          where: { hubId_userId: { hubId: hostHub.id, userId: u.id } },
          create: { hubId: hostHub.id, userId: u.id, position: "Host", isCoordinator: false },
          update: {},
        });
        await db.user.update({
          where: { id: u.id },
          data: { roles: { set: u.roles.filter((r) => r !== "HOST") } },
        });
      }
      // Strip HOST from any course's requiredRoles gate too — a course gated on
      // HOST would otherwise become invisible / un-enrollable once nobody holds it.
      const hostGatedCourses = await db.course.findMany({
        where: { requiredRoles: { has: "HOST" } },
        select: { id: true, requiredRoles: true },
      });
      for (const c of hostGatedCourses) {
        await db.course.update({
          where: { id: c.id },
          data: { requiredRoles: { set: c.requiredRoles.filter((r) => r !== "HOST") } },
        });
      }
      await db.$executeRawUnsafe(
        `INSERT INTO "_migration_flags" (name) VALUES ('retire_host_role_v1')`,
      );
      console.log(
        `  ✔ retire_host_role_v1: stripped HOST from ${hostRoleUsers.length} user(s) + ${hostGatedCourses.length} course gate(s); host-team membership ensured.`,
      );
    }
  } else {
    console.log("  ⏭ retire_host_role_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Portable document model. This historical migration introduced a document
  // kind enum, visibility, nullable origin hub, and cross-hub placements.
  //   • enums HubDocKind / HubDocVisibility
  //   • hub_documents gains docKind, storageKey, version, visibility
  //   • hubId made nullable (hubless project/community docs)
  //   • new hub_document_placements join (cross-hub sharing — one canonical
  //     doc surfaced in many hubs, never duplicated)
  //   • docKind backfilled for existing rows (PDF→UPLOAD, other links→LINK;
  //     native rows keep the NATIVE default)
  // Raw SQL references @@map table names (hub_documents,
  // hub_document_placements, hubs). DO-block guards make enum + FK creation
  // re-runnable.
  // ───────────────────────────────────────────────────────────────────────
  const onlyofficeDocsFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'onlyoffice_documents_v1'
  `).catch(() => []);

  if (onlyofficeDocsFlag.length === 0) {
    console.log("→ Portable document model (enums, columns, placements, nullable hubId)…");
    await db.$executeRawUnsafe(
      `DO $$ BEGIN CREATE TYPE "HubDocKind" AS ENUM ('NATIVE','ONLYOFFICE','LINK','UPLOAD'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await db.$executeRawUnsafe(
      `DO $$ BEGIN CREATE TYPE "HubDocVisibility" AS ENUM ('HUB','COORDINATORS','COMMUNITY'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hub_documents" ADD COLUMN IF NOT EXISTS "docKind" "HubDocKind" NOT NULL DEFAULT 'NATIVE'`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hub_documents" ADD COLUMN IF NOT EXISTS "storageKey" TEXT`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hub_documents" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hub_documents" ADD COLUMN IF NOT EXISTS "visibility" "HubDocVisibility" NOT NULL DEFAULT 'HUB'`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hub_documents" ALTER COLUMN "hubId" DROP NOT NULL`,
    );
    // Backfill docKind for existing rows (native rows keep the NATIVE default).
    await db.$executeRawUnsafe(
      `UPDATE "hub_documents" SET "docKind" = 'UPLOAD' WHERE "isNative" = false AND "fileType" = 'PDF'`,
    );
    await db.$executeRawUnsafe(
      `UPDATE "hub_documents" SET "docKind" = 'LINK' WHERE "isNative" = false AND "fileType" <> 'PDF'`,
    );
    // Cross-hub sharing join.
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "hub_document_placements" ("id" TEXT NOT NULL, "documentId" TEXT NOT NULL, "hubId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "hub_document_placements_pkey" PRIMARY KEY ("id"))`,
    );
    await db.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "hub_document_placements_documentId_hubId_key" ON "hub_document_placements"("documentId","hubId")`,
    );
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "hub_document_placements_hubId_idx" ON "hub_document_placements"("hubId")`,
    );
    await db.$executeRawUnsafe(
      `DO $$ BEGIN ALTER TABLE "hub_document_placements" ADD CONSTRAINT "hub_document_placements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "hub_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await db.$executeRawUnsafe(
      `DO $$ BEGIN ALTER TABLE "hub_document_placements" ADD CONSTRAINT "hub_document_placements_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('onlyoffice_documents_v1')`,
    );
    console.log("  ✔ Portable document model ready (placements table, nullable hubId, docKind backfilled).");
  } else {
    console.log("  ⏭ onlyoffice_documents_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Retire OnlyOffice. The office documents were test records only, so this
  // migration permanently removes their database rows and Blob files, then
  // removes the office-only fields and enum value. The portable filing model
  // (placements, visibility, nullable hubId) remains intact for native docs,
  // links, and uploads.
  // ───────────────────────────────────────────────────────────────────────
  const retireOnlyOfficeFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'retire_onlyoffice_v1'
  `).catch(() => []);

  if (retireOnlyOfficeFlag.length === 0) {
    const officeDocs = await db.$queryRawUnsafe(
      `SELECT "storageKey" FROM "hub_documents" WHERE "docKind"::text = 'ONLYOFFICE'`,
    );
    const blobUrls = officeDocs
      .map((row) => row.storageKey)
      .filter((url) => typeof url === "string" && url.includes(".public.blob.vercel-storage.com"));

    if (blobUrls.length > 0) {
      try {
        await del(blobUrls);
      } catch (err) {
        // The database cleanup must still finish; failed Blob cleanup is logged
        // for a one-time manual sweep rather than leaving retired records live.
        console.error("[retire_onlyoffice_v1] Could not delete office blobs", err);
      }
    }

    // Keep the schema change atomic: if any DDL fails, Postgres rolls it all
    // back and this migration can safely retry on the next build.
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`DELETE FROM "hub_documents" WHERE "docKind"::text = 'ONLYOFFICE'`);
      await tx.$executeRawUnsafe(`ALTER TABLE "hub_documents" DROP COLUMN IF EXISTS "storageKey"`);
      await tx.$executeRawUnsafe(`ALTER TABLE "hub_documents" DROP COLUMN IF EXISTS "version"`);
      await tx.$executeRawUnsafe(`ALTER TABLE "hub_documents" ALTER COLUMN "docKind" DROP DEFAULT`);
      await tx.$executeRawUnsafe(`CREATE TYPE "HubDocKind_retired" AS ENUM ('NATIVE', 'LINK', 'UPLOAD')`);
      await tx.$executeRawUnsafe(
        `ALTER TABLE "hub_documents" ALTER COLUMN "docKind" TYPE "HubDocKind_retired" USING "docKind"::text::"HubDocKind_retired"`,
      );
      await tx.$executeRawUnsafe(`DROP TYPE "HubDocKind"`);
      await tx.$executeRawUnsafe(`ALTER TYPE "HubDocKind_retired" RENAME TO "HubDocKind"`);
      await tx.$executeRawUnsafe(`ALTER TABLE "hub_documents" ALTER COLUMN "docKind" SET DEFAULT 'NATIVE'`);
      await tx.$executeRawUnsafe(`INSERT INTO "_migration_flags" (name) VALUES ('retire_onlyoffice_v1')`);
    });
    console.log(`  ✔ retire_onlyoffice_v1: removed ${officeDocs.length} test office document(s) and retired the office schema.`);
  } else {
    console.log("  ⏭ retire_onlyoffice_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Google Workspace Files foundation (Slice 1 — RIM_GoogleWorkspace.md).
  // Additive only: the hub→Shared-Drive mapping columns (all nullable /
  // default-off, so nothing changes for existing hubs) and the audit table.
  // Raw SQL references the @@map table names ("hubs", "google_file_audit").
  // ───────────────────────────────────────────────────────────────────────
  const googleFoundationFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'google_workspace_foundation_v1'
  `).catch(() => []);

  if (googleFoundationFlag.length === 0) {
    console.log("→ Google Workspace Files foundation (hub mapping + audit table)…");
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "googleDriveId" TEXT`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "googleRootFolderId" TEXT`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "googleFilesEnabled" BOOLEAN NOT NULL DEFAULT false`,
    );
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "google_file_audit" (
        "id"           TEXT PRIMARY KEY,
        "userId"       TEXT,
        "hubId"        TEXT,
        "action"       TEXT NOT NULL,
        "googleFileId" TEXT,
        "detail"       JSONB,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "google_file_audit_hubId_idx" ON "google_file_audit"("hubId")`,
    );
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "google_file_audit_userId_idx" ON "google_file_audit"("userId")`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('google_workspace_foundation_v1')`,
    );
    console.log("  ✔ hubs.googleDriveId/googleRootFolderId/googleFilesEnabled + google_file_audit ready.");
  } else {
    console.log("  ⏭ google_workspace_foundation_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Google Workspace Files uploads (Slice 3 — RIM_GoogleWorkspace.md). A
  // large upload stages in Vercel Blob, then transfers into Drive via
  // after() + a cron backstop; this ledger tracks that hand-off. Additive
  // only — a brand-new table, nothing existing changes.
  // ───────────────────────────────────────────────────────────────────────
  const googleTransfersFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'google_file_transfers_v1'
  `).catch(() => []);

  if (googleTransfersFlag.length === 0) {
    console.log("→ Google Workspace Files transfer ledger (Slice 3 uploads)…");
    await db.$executeRawUnsafe(
      `DO $$ BEGIN CREATE TYPE "GoogleFileTransferStatus" AS ENUM ('PENDING','PROCESSING','DONE','FAILED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "google_file_transfers" (
        "id"            TEXT PRIMARY KEY,
        "userId"        TEXT NOT NULL,
        "placeKey"      TEXT NOT NULL,
        "folderId"      TEXT,
        "fileName"      TEXT NOT NULL,
        "mimeType"      TEXT NOT NULL,
        "blobUrl"       TEXT NOT NULL,
        "blobPathname"  TEXT NOT NULL,
        "status"        "GoogleFileTransferStatus" NOT NULL DEFAULT 'PENDING',
        "attempts"      INTEGER NOT NULL DEFAULT 0,
        "lastError"     TEXT,
        "googleFileId"  TEXT,
        "blobDeletedAt" TIMESTAMP(3),
        "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "google_file_transfers_status_idx" ON "google_file_transfers"("status")`,
    );
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "google_file_transfers_userId_idx" ON "google_file_transfers"("userId")`,
    );
    await db.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "google_file_transfers_blobPathname_key" ON "google_file_transfers"("blobPathname")`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('google_file_transfers_v1')`,
    );
    console.log("  ✔ google_file_transfers ready.");
  } else {
    console.log("  ⏭ google_file_transfers_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Mind Maps removal — Phase 1 (data cleanup only; NO schema drop).
  // The feature was retired: its code, Prisma models, and the
  // HubConversationThread.mindMapNodeId field are gone. Topic conversations
  // were HubConversationThread rows with a real hubId + documentId NULL +
  // mindMapNodeId set — so the hub Conversations and Activity feeds (which
  // filter on documentId only, never mindMapNodeId) would otherwise surface
  // them as phantom threads. Delete them here; the replies + subscriptions
  // FKs are ON DELETE CASCADE, so they clear automatically. Deleting ROWS is
  // safe against the still-live previous deployment during the build-time
  // migrate window (it just sees fewer threads). The mindMapNodeId column, its
  // unique index, the mind_map_* tables, and the 'mindmap-topic-comment' email
  // row are dropped in a Phase-2 follow-up deploy — only safe once no live
  // code selects that column.
  // ───────────────────────────────────────────────────────────────────────
  const mindMapThreadsFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'remove_mindmap_topic_threads_v1'
  `).catch(() => []);

  if (mindMapThreadsFlag.length === 0) {
    console.log("→ Removing orphaned mind-map topic conversation threads…");
    // Only delete while the column still exists (guards against Phase 2 having
    // run first in an out-of-order apply).
    const mmCol = await db.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'hub_conversation_threads' AND column_name = 'mindMapNodeId'
    `).catch(() => []);
    if (mmCol.length > 0) {
      const deleted = await db.$executeRawUnsafe(
        `DELETE FROM "hub_conversation_threads" WHERE "mindMapNodeId" IS NOT NULL`,
      );
      console.log(`  ✔ deleted ${deleted} mind-map topic thread(s) (+ cascaded replies/subscriptions).`);
    } else {
      console.log("  ⏭ mindMapNodeId column already gone — nothing to delete.");
    }
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('remove_mindmap_topic_threads_v1')`,
    );
  } else {
    console.log("  ⏭ remove_mindmap_topic_threads_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Mind Maps removal — Phase 2 (schema drop). Safe now: the live deployment
  // is the Phase-1 build, whose code no longer references the mindMapNodeId
  // column or the mind_map_* tables, so dropping them can't 500 live traffic.
  // Re-sweeps any topic threads created in the window between the two deploys,
  // then drops the FK, unique index, and column from hub_conversation_threads;
  // the three mind_map_* tables; and the orphaned mindmap-topic-comment email
  // template row. All IF EXISTS / deleteMany, so it's a clean no-op on a fresh
  // DB (the Phase-1 CREATE migration entries were removed — nothing creates
  // these objects anymore).
  // ───────────────────────────────────────────────────────────────────────
  const mindMapSchemaFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'remove_mindmap_schema_v1'
  `).catch(() => []);

  if (mindMapSchemaFlag.length === 0) {
    console.log("→ Dropping mind-map schema (Phase 2)…");
    // Final sweep of any topic threads created in the interim (column may
    // already be gone on a fresh DB, in which case there's nothing to sweep).
    const mmCol2 = await db.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'hub_conversation_threads' AND column_name = 'mindMapNodeId'
    `).catch(() => []);
    if (mmCol2.length > 0) {
      const swept = await db.$executeRawUnsafe(
        `DELETE FROM "hub_conversation_threads" WHERE "mindMapNodeId" IS NOT NULL`,
      );
      console.log(`  ✔ final sweep: deleted ${swept} interim topic thread(s).`);
    }
    await db.$executeRawUnsafe(
      `ALTER TABLE "hub_conversation_threads" DROP CONSTRAINT IF EXISTS "hub_conversation_threads_mindMapNodeId_fkey"`,
    );
    await db.$executeRawUnsafe(
      `DROP INDEX IF EXISTS "hub_conversation_threads_mindMapNodeId_key"`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hub_conversation_threads" DROP COLUMN IF EXISTS "mindMapNodeId"`,
    );
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "mind_map_placements" CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "mind_map_nodes" CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "mind_maps" CASCADE`);
    const delTpl = await db.emailTemplate.deleteMany({
      where: { slug: "mindmap-topic-comment" },
    });
    console.log(
      `  ✔ dropped mind_map_* tables + mindMapNodeId column; removed ${delTpl.count} email template row(s).`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('remove_mindmap_schema_v1')`,
    );
  } else {
    console.log("  ⏭ remove_mindmap_schema_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Community Space (session 165). Adds the openToAllMembers access primitive
  // (additive column, safe against live-old code) and seeds the one
  // open-to-all Space, "Community", so the all-members Google file cabinet has
  // a real home once the global /account/files finder is retired. Community's
  // Files ride the name-resolved "RIM — Community" Drive via the community
  // place — NOT a hub drive mapping — so googleDriveId stays null (mapping it
  // whole-drive would both double-list the place and reserve-drive-collide);
  // its Files tab renders through the openToAll path in the UI.
  // ───────────────────────────────────────────────────────────────────────
  const communitySpaceFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'community_space_v1'
  `).catch(() => []);

  if (communitySpaceFlag.length === 0) {
    console.log("→ Community Space (openToAllMembers primitive + seed)…");
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "openToAllMembers" BOOLEAN NOT NULL DEFAULT false`,
    );
    await db.$executeRawUnsafe(
      `ALTER TABLE "hubs" ADD COLUMN IF NOT EXISTS "conversationsEnabled" BOOLEAN NOT NULL DEFAULT true`,
    );
    const existingCommunity = await db.hub.findUnique({ where: { slug: "community" } });
    if (!existingCommunity) {
      await db.hub.create({
        data: {
          slug: "community",
          name: "Community",
          type: "COMMUNITY_GROUP",
          status: "ACTIVE",
          openToAllMembers: true,
          // Launch Files-only; an admin turns Conversations on from hub settings.
          conversationsEnabled: false,
          description:
            "The whole sangha's shared Space — files open to every member.",
          conversationCategories: ["General"],
        },
      });
      console.log("  ✔ created the Community Space (Files-only).");
    } else {
      // Never clobber a hand-made 'community' hub — just ensure the primitive.
      await db.hub.update({
        where: { slug: "community" },
        data: { openToAllMembers: true },
      });
      console.log("  ✔ Community hub already existed — ensured openToAllMembers.");
    }
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('community_space_v1')`,
    );
  } else {
    console.log("  ⏭ community_space_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Google cutover marker (session 165) — records the Google file id once a
  // native HubDocument has been migrated, so the migrate step is idempotent
  // and never double-migrates. Additive; native rows are untouched until the
  // separate two-phase retirement.
  // ───────────────────────────────────────────────────────────────────────
  const migratedColFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'hub_document_migrated_google_file_id_v1'
  `).catch(() => []);
  if (migratedColFlag.length === 0) {
    console.log("→ hub_documents.migratedGoogleFileId (Google cutover marker)…");
    await db.$executeRawUnsafe(
      `ALTER TABLE "hub_documents" ADD COLUMN IF NOT EXISTS "migratedGoogleFileId" TEXT`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('hub_document_migrated_google_file_id_v1')`,
    );
    console.log("  ✔ column ready.");
  } else {
    console.log("  ⏭ hub_document_migrated_google_file_id_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Native Documents retirement — Phase 1 (data cleanup, NO schema drop).
  // The native document system is gone (code + Prisma models removed). Its
  // per-document conversation threads were HubConversationThread rows with a
  // real hubId + documentId set — so, exactly like the Mind Maps retirement,
  // they'd otherwise surface as phantom threads in the hub Conversations /
  // Activity feeds (which no longer filter documentId). Delete them here;
  // replies + subscriptions cascade. Deleting ROWS is safe against the still-
  // live previous deployment during the build-time migrate window. The
  // hub_documents* tables, the documentId / documentCategories columns, the
  // doc enums, and the hub-document-* email rows drop in a Phase-2 follow-up
  // deploy (only safe once no live code selects those columns).
  // ───────────────────────────────────────────────────────────────────────
  const docThreadsFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'remove_document_conversation_threads_v1'
  `).catch(() => []);

  if (docThreadsFlag.length === 0) {
    console.log("→ Removing orphaned document-conversation threads…");
    const docCol = await db.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'hub_conversation_threads' AND column_name = 'documentId'
    `).catch(() => []);
    if (docCol.length > 0) {
      const deleted = await db.$executeRawUnsafe(
        `DELETE FROM "hub_conversation_threads" WHERE "documentId" IS NOT NULL`,
      );
      console.log(`  ✔ deleted ${deleted} document-conversation thread(s) (+ cascaded replies/subscriptions).`);
    } else {
      console.log("  ⏭ documentId column already gone — nothing to delete.");
    }
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('remove_document_conversation_threads_v1')`,
    );
  } else {
    console.log("  ⏭ remove_document_conversation_threads_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Native Documents retirement — Phase 2 (schema drop). Safe now: the live
  // deployment is the Phase-1 build, whose code no longer references the
  // hub_documents* tables, the documentId / documentCategories columns, or the
  // doc enums. Re-sweeps any doc-conversation thread created in the window
  // between the deploys, then drops the columns (CASCADE clears the FK +
  // index), the three tables, the doc enums, and the orphaned document email
  // rows. All IF EXISTS. (The historical doc CREATE/seed blocks earlier in this
  // file are left as-is — flag-guarded, so they no-op on prod; on a fresh DB
  // they create-then-drop, wasteful but harmless.)
  // ───────────────────────────────────────────────────────────────────────
  const docSchemaFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'remove_document_schema_v1'
  `).catch(() => []);

  if (docSchemaFlag.length === 0) {
    console.log("→ Dropping native Documents schema (Phase 2)…");
    const docCol2 = await db.$queryRawUnsafe(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'hub_conversation_threads' AND column_name = 'documentId'
    `).catch(() => []);
    if (docCol2.length > 0) {
      const swept = await db.$executeRawUnsafe(
        `DELETE FROM "hub_conversation_threads" WHERE "documentId" IS NOT NULL`,
      );
      console.log(`  ✔ final sweep: deleted ${swept} interim document-conversation thread(s).`);
    }
    // Drop the anchor column with CASCADE so its FK + index go with it (no need
    // to know their generated names).
    await db.$executeRawUnsafe(
      `ALTER TABLE "hub_conversation_threads" DROP COLUMN IF EXISTS "documentId" CASCADE`,
    );
    await db.$executeRawUnsafe(`ALTER TABLE "hubs" DROP COLUMN IF EXISTS "documentCategories"`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "hub_document_notifications" CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "hub_document_placements" CASCADE`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "hub_documents" CASCADE`);
    await db.$executeRawUnsafe(`DROP TYPE IF EXISTS "HubDocumentFileType" CASCADE`);
    await db.$executeRawUnsafe(`DROP TYPE IF EXISTS "HubDocKind" CASCADE`);
    await db.$executeRawUnsafe(`DROP TYPE IF EXISTS "HubDocVisibility" CASCADE`);
    const delDocTpls = await db.emailTemplate.deleteMany({
      where: { slug: { in: ["hub-document-created", "hub-document-updated"] } },
    });
    console.log(
      `  ✔ dropped hub_documents* tables + doc columns/enums; removed ${delDocTpls.count} email template row(s).`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('remove_document_schema_v1')`,
    );
  } else {
    console.log("  ⏭ remove_document_schema_v1 already applied.");
  }

  // ───────────────────────────────────────────────────────────────────────
  // Google Files per-file state layer (RIM_GoogleWorkspace.md, file-detail
  // slice). RIM's own record of who created a file + whether it's a draft
  // (held). Additive — a brand-new table, nothing existing changes. Also
  // backfills creatorUserId from the audit log so files RIM already created
  // show a real "Created by" immediately; heldAt stays NULL on the backfill so
  // existing files remain visible (opt-out default — never retroactively hide).
  // ───────────────────────────────────────────────────────────────────────
  const googleFileMetaFlag = await db.$queryRawUnsafe(`
    SELECT name FROM "_migration_flags" WHERE name = 'google_file_meta_v1'
  `).catch(() => []);

  if (googleFileMetaFlag.length === 0) {
    console.log("→ Google Files per-file state (creator + draft) …");
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "google_file_meta" (
        "id"            TEXT PRIMARY KEY,
        "googleFileId"  TEXT NOT NULL,
        "creatorUserId" TEXT,
        "heldAt"        TIMESTAMP(3),
        "hubId"         TEXT,
        "placeKey"      TEXT,
        "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "google_file_meta_googleFileId_key" ON "google_file_meta"("googleFileId")`,
    );
    await db.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "google_file_meta_creatorUserId_idx" ON "google_file_meta"("creatorUserId")`,
    );
    // Backfill creator from the earliest create-*/upload audit row per file.
    const backfilled = await db.$executeRawUnsafe(`
      INSERT INTO "google_file_meta" ("id","googleFileId","creatorUserId","hubId","createdAt","updatedAt")
      SELECT DISTINCT ON ("googleFileId")
        gen_random_uuid()::text, "googleFileId", "userId", "hubId", NOW(), NOW()
      FROM "google_file_audit"
      WHERE "googleFileId" IS NOT NULL
        AND ("action" LIKE 'create-%' OR "action" = 'upload')
      ORDER BY "googleFileId", "createdAt" ASC
      ON CONFLICT ("googleFileId") DO NOTHING
    `);
    await db.$executeRawUnsafe(
      `INSERT INTO "_migration_flags" (name) VALUES ('google_file_meta_v1')`,
    );
    console.log(`  ✔ google_file_meta ready; backfilled ${backfilled} creator record(s).`);
  } else {
    console.log("  ⏭ google_file_meta_v1 already applied.");
  }

  await db.$disconnect();
  console.log("Migrations complete.");
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await db.$disconnect();
  process.exit(1);
});
