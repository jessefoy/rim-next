# What RIM's site is for, and why it is built this way

This file explains the thinking behind Rooted in Mindfulness's website and its apps. Use it when a volunteer asks "why does it work like this?" or "why can't I see that?" Answer from here first, in plain words, and point to the part of the design the answer comes from.

Much of the wording on the site is still provisional. Jesse reads new wording aloud before he approves it, and until he has, any line may still change.

## The root: clear seeing

RIM's design starts from one idea from the Dharma: clear seeing comes before a wise and kind response. When a mind is cluttered, it can't see what is in front of it. It reacts instead.

A web page can clutter the mind the same way. Too many buttons, banners and boxes compete for attention, and the person using the page stops seeing the one thing that matters: the member they are helping, the session that needs a host, the next step to take.

So every screen at RIM is meant to ask one question: does this help the person see clearly what is here? This holds on the public pages, the member pages, the team spaces, the volunteer apps and the staff screens alike. The Dharma doesn't stop at the door of an admin page.

## Restraint

The usual habit in web design is to add: another banner, another button, another explanation. RIM works the other way. The question is "what can we take away?"

Anything on a page that the person doesn't need right now is not neutral. It pulls attention. So pages are kept quiet on purpose:

- Few colors, plain backgrounds, white panels with a thin border and no shadows.
- One clear main action on a screen, not several of the same weight.
- Headings, size and spacing do the work of emphasis, not color, icons or motion.
- Home pages stay short. My Home shows today. A team's Home shows the team's one main app and a few destinations. The detail lives inside each destination.

When a volunteer asks why something isn't on a page, the honest answer is often: it was left off on purpose, so the page stays readable. If they think it is genuinely needed, that is good feedback to pass on.

## Designing for someone who feels lost

Many of RIM's members and volunteers are older, or not comfortable with technology. When anyone feels lost on a screen, they don't slow down and read more carefully. They start tapping, backing out and tapping again. Labels stop registering.

The design can't remove that feeling, but it can make it less likely and less harmful. The rules RIM follows:

- **Take away what isn't needed now.** Fewer things on screen means less to sort through.
- **Make the main action stand out by its look.** The button that does the work is filled in blue. Other actions are quieter.
- **Make a wrong tap safe.** Anything that can't be undone, like deleting, asks first in plain words, with a clear way out.
- **Say where you are in a sentence.** A plain sentence at the top tells someone where they are, which works even when they aren't really reading.
- **Show the way back.** Every working page has a plainly named way back, like "← Programs."

The test for any screen: does it work for someone who is overwhelmed and not reading carefully? If not, it isn't finished.

## Forms are thresholds

Signing up, joining and registering are moments when a person crosses from visitor to participant. RIM treats them as welcomes, not paperwork. Forms ask for as little as possible, use plain human words, and give kind, specific error messages.

### Every send or save is answered where the person is looking

Jesse set this rule for every page after a volunteer form he sent seemed to do nothing. The thank-you had appeared at the bottom of the page while he was looking at the top. Someone who can't see that a form worked will send it again, or leave thinking it failed.

So on every page:

- **Success comes to the person.** The confirmation appears where they are, scrolled into view, and stays. The first line says plainly what happened ("Your note has been sent"). The next says what happens now. When nothing more is needed, it says "You don't need to do anything else."
- **A problem appears beside the button they pressed,** not at the top of a long form. What they wrote stays.
- **The button shows the work** ("Sending…", "Saving…") and can't be pressed twice.
- **What RIM already knows is filled in** for a signed-in member: name, email, phone.
- **Nothing fails silently.**

If a volunteer reports that they pressed Save and didn't see an answer, that breaks this rule, and it is worth a feedback note.

## The three layers: records, teams, apps

RIM's system has three layers, and knowing which one someone is in answers most "why can't I see that?" questions.

1. **The member records** (the Member Registry, under Manage RIM). This is the full, official record of every person: contact details, roles, households, registrations. Only Admin and the Registrar can open it.
2. **Team spaces.** Each volunteer team has its own space, with Home, Updates, Conversations, Files and Members. People see only the teams they belong to.
3. **Apps.** Focused tools for a piece of work: Programs, Registration, the Scheduler, Helping with, the Course Manager. A team's main app shows on its Home.

### Why volunteers see a scoped view, not the member records

The rule is: volunteers reach member information through their team or their app, never through the member records. A host sees what hosting needs. A greeter sees today's list for their session. A teacher sees who is coming to their program and what they shared with the teacher. Nobody gets a cut-down copy of the full records.

This protects members' privacy, keeps each volunteer's work simple, and keeps a clear line between volunteer work and record-keeping. When a new need comes up, the question asked is: does this role need a working view of people, or authority over the records? Almost always it is a working view, built inside that team or app.

## Decisions volunteers often ask about

### Members can't cancel their own registration

There is no "cancel my registration" button for members. Cancelling goes through the registration team, who can cancel someone from the Registration app, and the person is sent a cancellation email. This was a deliberate decision and it stays unless Jesse reverses it. The full reasoning isn't written down in the guide's sources. Not certain: ask Jesse.

### Dana amounts are seen by three roles only

How much someone gave is private. Only the Registrar, Admin and Guiding teacher roles see dana amounts. Teachers, greeters, helpers and team members never do, even on pages that show who is coming. Giving at RIM is a gift, offered as each person is able, and it isn't anyone else's business.

### Category and Format are labels. They never decide who can join

Every program has a Category (Foundations, Ongoing Learning & Practice, Immersion, Community Group, Special Event, and two internal ones, Service and Private) and a Format (Drop-in, Class, Course, Workshop, Day of mindfulness, Retreat). These decide where a program is listed and how it is described. They never decide access, registration, or the suggested contribution.

Who can join is its own separate setting, chosen on purpose for each program. Jesse called this the point that matters most: a label should never decide who gets in.

### Open entry

Open entry is that access setting. When it is on, anyone signed in may join the program, in person or on Zoom, without registering. When it is off, people register first. It is set in How people join on the program's page ("They just come", or "Both"), and works independently of registration.

Open entry is not the same as the guest link, which lets someone without an account into an online session.

### A team's "Leads only" files

In every team's Files, the team's leads (an active team lead, the Guiding teacher, and an Admin who is on the team) can keep files in a **Leads only** area, separate from **Team files**. Leads can move a file or a folder between the two. Members see only Team files, exactly as before. This gives leads a place to prepare or keep sensitive material without a second system.

### Programs and Registration are two apps

Setting a program up and looking after its people are different work, so they live in two apps.

- **Programs** (`/tools/programs`) is for setting programs up: the description, dates, place, teachers and teams, how people join, messages, dana and where it appears. It shows no one's personal details. The Registrar, Admin and Guiding teacher roles can use it, and so can active members of the teams that set programs up (the Registration team and Program Central). Archiving, deleting and managing categories stay with the three roles.
- **Registration** (`/tools/registration`) is for the people: who registered, their answers, notes, dana, messages and history. Only the Registrar, Admin and Guiding teacher roles can open it, because it holds personal details.

### The three kinds of button

On signed-in working pages, buttons come in three kinds, so the eye finds the right one:

- **The button that does the work is filled** (Save, Send, the "Yes" in a question). A confirming delete is filled in red.
- **A button that only opens something, or is secondary, is quiet text** (People, Edit, Archive, Add a person, Cancel). It is still easy to tap.
- **The way back is plain text** ("← Programs").

A rule of thumb: a button that only opens a question is quiet, and the "Yes" in that question is filled. A list whose whole purpose is one action per row may keep that action filled, like the Scheduler's "Yes, I can host this."

Members' personal pages (My Home, My Profile) keep the public site's own buttons.

### One way to filter lists

Lists that filter, like Updates, Notifications, Conversations, Files and the Scheduler, all use the same controls: a row of pills (such as All, For you, Unread) and a View picker. Jesse's words: "Consistency is key." Learning it once works everywhere.

### The site's header never changes

Every page, public or signed in, wears the same site header with the RIM logo. Testers once said that a separate member header felt like leaving the site. Now the logo always goes to the home page, and signed in, the header shows **My Home** in the same place. Working pages (team spaces, apps, admin) leave out the footer, so they end where the work ends.

## Words people read on the site

- **Team.** A volunteer group's space. The code calls it a "hub", but the site always says "team".
- **My Home.** A member's own page. It shows today: sessions they can join, a duty they have that day ("You're greeting"), and the week's schedule.
- **My Teams.** The list of teams someone belongs to. It shows only for people on a team, and the Guiding teacher.
- **Team Home.** A team's first page: the team's name and one line about it, its main app in one card, then Conversations, Files, Members and any links.
- **Updates.** A team's inbox of what happened on the team. It can be read by type, has "Needs you" at the top for sessions that need someone, and each item opens the exact thing.
- **Notifications.** A person's own inbox, from every team they're on and about their own registrations and account. In My Profile, people choose how team news is emailed: each one, one email a day, or none. Emails about the person themselves always come.
- **Conversations.** A team's discussion threads.
- **Files.** A team's shared documents, kept in Google Drive behind the scenes. People don't need a Google account.
- **Members.** A team's list of people.
- **Library.** Where courses will live. For now it is a page saying what it will hold.
- **Community Care.** The Community Care Agreements, which every member agrees to when they join.
- **Manage RIM.** The staff entrance to the administration pages.
- **Teaching.** A teacher's page for their programs: who's coming and what they told the teacher.
- **Today's list.** A greeter's or other supporting team's list for one session, with Arrived.
- **Helping with.** The app for teams that prepare, like a kitchen team: how many are coming and the answers to the team's own questions.
- **The Scheduler.** Where teams sign up to host, greet or run sound for sessions, and where leads set rotations.
- **Notice.** A short, timely message on a program (a change of room, say), with a date it clears by.
- **Session note.** A quiet line of routine preparation shown with a session on My Home.
- **Dana.** Giving, as each person is able. Programs are freely offered and community-supported.

## Roles, in plain words

There are two kinds of standing at RIM: roles, which are system powers, and team membership.

### Roles

- **Admin.** Runs the system itself: configuration, teams, the member records, emails. A technical trust, not a spiritual one.
- **Guiding teacher.** Dharma authority across the whole community (Jesse holds it). Can step into any team as a lead for its content: conversations, files, members. Doesn't run the technical configuration.
- **Registrar.** Looks after programs and the people who register. Can open the member records, Programs and Registration, and see dana amounts.
- **Teacher.** Teaches programs and courses. Sees their own programs' Teaching page and can use the Course Manager.
- **Scheduling manager.** Can manage rotations and coverage for every scheduling team.

### Team membership

- **Team lead** (the system's word is "Coordinator"). Leads one team: manages its members, its schedule and coverage, its Leads only files, and its Home line. A lead's powers apply to their own team only, and only while they are active.
- **Member.** Belongs to a team. Takes part in its conversations and files, and signs up for sessions if the team schedules.

Being a host is team membership, not a role: hosts are the members of the Hosting Team. A person can be on several teams. They see each team in its own space, never one merged view of everyone.

A team member can be **Active**, **Paused** (stepping back for a while, with a note) or **Inactive**. Inactive means removed from that team's schedule: their upcoming sessions open up and the team is told.
