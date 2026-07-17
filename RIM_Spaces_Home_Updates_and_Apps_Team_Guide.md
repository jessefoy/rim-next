# RIM Spaces: Home, Updates, and Apps

## A plain-English guide for the RIM team

*Prepared July 17, 2026*

## What this work was about

We reviewed how RIM's team Spaces—sometimes called hubs in older documentation and administrative screens—present their Home page, recent activity, and specialized tools.

The main concern was that these ideas had begun to overlap:

- Home sometimes acted like a summary page and an activity feed at the same time.
- The old Activity display did not always make it obvious whether something came from a conversation, a file, a file comment, a member change, or a specialized app.
- Some Spaces had a specialized app while others did not, which made it unclear whether every Space needed its own custom design.
- It was not clear whether a Space could have more than one app or which app should receive the most attention.
- Creating a Space for a new team sometimes felt like it might require Jesse to ask Codex or Claude to build something special.

We have now clarified the model and implemented it throughout the system.

## The simple model

Every RIM team begins with the same dependable Space.

A standard Space includes:

- Home
- Updates
- Conversations
- Files, when file storage is enabled
- Members
- Team guidance and orientation

This basic Space does not need a specialized app in order to be useful. An administrator can create a Space for a new team, add its members and coordinators, and use the shared features immediately.

An app is an optional addition to the Space. It supports a particular kind of work, such as scheduling, program management, or course management. The app does not replace the Space or create a completely different version of Home.

In short:

> The Space is the team's shared place. An app is a tool added to that place.

## What changed on Home

Home is now a calm starting point rather than another activity feed.

The Home page can show:

- A simple greeting and a clear statement about whether anything needs the person's attention
- A short **Needs your attention** section, only when something is genuinely relevant to that person
- Welcome information for the team
- The Space's primary app, if it has one
- Smaller supporting apps, if it has more than one
- Useful connected links
- Pinned conversations
- Long-lived orientation, practices, or team guidance

We removed the chronological Recent Activity list from Home. That information already belongs in Updates, and showing it in both places made the system feel busier and less clear.

The Welcome and Orientation areas now work consistently across ordinary Spaces, not only Spaces that use the Scheduler.

## Activity is now called Updates

The shared activity area is now presented to people as **Updates**.

The underlying web address still ends in `/activity`. We kept that address stable so existing bookmarks and links continue to work.

Every Update now identifies where it came from. Examples include:

- **Conversation** — someone started a conversation
- **Conversation reply** — someone replied to a conversation
- **Files** — someone uploaded, shared, or changed a file
- **File comment** — someone commented on a file
- **Members** — someone joined the Space
- **Scheduler** — someone requested or claimed coverage

This makes it much easier to understand what happened before deciding whether to open it.

Updates has three simple views:

- **All** — meaningful changes from across the Space
- **New** — changes since the person last opened Updates
- **For me** — items especially relevant to that person, such as a reply in a conversation they follow, a comment on a file they created, or an app-specific request they can act on

The Space navigation uses a quiet dot to indicate that Updates contains something new. Passive history is not presented as an urgent numerical alert.

## Shared Updates and personal attention are different

We separated two ideas that were previously easy to confuse.

**Shared Updates** answers:

> What meaningful things have happened in this Space?

**Needs your attention** answers:

> Is there something here that this particular person may need to respond to?

Most activity is useful history, not a request for action. It remains in Updates. Only genuinely personal or actionable items appear in Needs your attention on Home.

This keeps Home quieter and helps people recognize when the system is actually asking something of them.

## How apps now work

A Space may have no apps, one app, or several apps.

When a Space has apps:

- One app is the **primary app**. It receives the clearest position on Home.
- Additional apps are **supporting apps**. They remain available without competing for attention.
- Ordinary web links may also be added, but they remain simple links. A link does not gain app behavior or access privileges.

If the primary app provides a fuller Home module, that module takes the place of the app's summary card. We do not show both and repeat the same information.

Each app remains responsible for the meaning of its own work. For example, the Scheduler understands coverage requests and claims. The Space supplies a consistent way to display the Scheduler's summary, Updates, and personal-attention items.

This means app information can appear in the shared Space without blending the app itself into the core Space features.

## Can a Space have multiple apps?

Yes. A Space can have one primary app and additional supporting apps.

This gives us flexibility without making the interface confusing. The primary app answers, “What specialized work is this team mainly here to do?” Supporting apps answer, “What other tools does this team sometimes need?”

The base Space remains understandable even when no apps are installed.

## Do we need Codex or Claude to create every new Space?

No.

Creating a new Space and installing an app that is already designed to work there should be an administrative setup task. It should not require new programming.

Codex or Claude is needed only when we are creating genuinely new app behavior, such as a new kind of tool, a new app summary, or a new kind of actionable Update.

This is an important improvement: teams can receive ordinary Spaces through configuration, while engineering work is reserved for capabilities that are actually new.

## Do apps need to be coded differently?

Existing apps do not need to be rebuilt simply to appear in a Space. Their current working screens remain their own.

New apps, and meaningful new integrations for existing apps, now follow a common set of rules. Before an app is treated as a real Space app, we must be able to answer:

- Which Spaces is it safe to use in?
- Can it be the primary app?
- What single contribution does it make to Home?
- Which of its events are meaningful enough to appear in Updates?
- Which items are personally actionable, and for whom?
- Does every part of the app use the correct Space's information, members, permissions, links, and notifications?
- Can the app be added or removed without damaging the base Space?

These rules have been added to the working instructions used by both Codex and Claude. Future app work should therefore begin from the same model rather than inventing a new kind of Space each time.

## Current app boundaries

The current specialized apps have different levels of portability:

- **Scheduler** is designed to work across multiple appropriate Spaces. Its schedule, coverage, links, Updates, and attention items stay connected to the active Space.
- **Program Manager** remains connected to the Registrar Space because its information and permissions are not intended to be freely mixed into other Spaces.
- **Course Manager** remains connected to the Courses Space for the same reason.

The system now prevents an administrator from casually installing an app in a Space where it is not yet safe. An app can become more widely available later, after its information and permissions have been deliberately prepared for that use.

## Safeguards included in the update

We added safeguards so this new flexibility does not make Spaces fragile:

- A Space cannot accidentally have two primary apps.
- The first suitable app becomes primary when needed.
- Disabling or removing a primary app safely selects another suitable app when one is available.
- Custom links can never become primary apps or grant app access.
- The administrative screen and the system itself both reject incompatible app installations.
- App changes and Space settings are saved together, so a failed change cannot leave all of a Space's app links deleted.
- Updates only show information belonging to the current Space.
- Draft files being held for review do not leak into Updates.
- App links preserve the active Space, so people do not silently land in another team's version of a tool.
- Existing app installations are preserved during ordinary edits rather than being unexpectedly removed.

## What did not change

- Team membership and access rules remain in place.
- Administrators configure Spaces, but do not automatically gain access to private team content merely because they are administrators.
- Conversations, Files, Members, and the specialized app screens continue to exist as their own areas.
- The Scheduler still owns scheduling and coverage work.
- Program Manager and Course Manager still own their respective work.
- Existing links to the former Activity address continue to work.
- No email or email-template behavior changed as part of this work.

## What team members should notice

For most team members, the experience should now feel simpler:

1. Open Home to understand the Space and see whether anything needs attention.
2. Open Updates to review what has changed and where it came from.
3. Open Conversations, Files, Members, or an app when ready to work in that area.

People should no longer have to interpret an unexplained mixed activity feed or wonder whether Home and Activity are telling them the same thing.

## What coordinators and administrators should know

- A new team can begin with a standard Space; an app is optional.
- Choose the app that best represents the team's main specialized work as the primary app.
- Add other apps only when they genuinely support the same team.
- Use custom links for useful destinations that do not need to exchange information with the Space.
- Keep Welcome content focused on greeting and expectations.
- Keep Orientation content focused on long-lived guidance, practices, and ways of working.
- Use pinned conversations for current shared context that should remain easy to find.

## Release and verification

This work was completed and deployed on July 17, 2026.

Before release, we checked:

- The full TypeScript application for code-level breakage
- Every changed interface and server file for linting problems
- The database change and its deployment order
- Mobile and responsive styling structure
- Space membership and access boundaries
- App links and Space-specific routing
- Production deployment, sign-in, protected Space routing, and the Updates endpoint

The deployment completed successfully. No email templates were added or changed.

## The guiding principle

The design is meant to support clear seeing:

- Home tells people where they are and what deserves attention.
- Updates tells people what changed and where it came from.
- Core Space features stay dependable for every team.
- Apps add specialized capability without taking over the Space.
- New teams can be set up simply, while new software behavior follows a consistent set of rules.

That is the universal model we will use for RIM Spaces going forward.
