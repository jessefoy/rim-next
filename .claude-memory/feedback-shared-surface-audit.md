# A surface shared by differently-behaving consumers: audit BOTH directions on every change

Some surfaces in RIM serve several consumers that use them *differently*. The Scheduler is the canonical case: one tool (`/tools/schedule`, `HubScheduleClient`, the assignment/sub-request/standing routes, `lib/applyStandingAssignments.ts`, `lib/programHub.ts`) shared by **four hubs that behave differently** — host-team + peer-led (single-slot, virtual/hybrid), audio-visual (single-slot aux, in-person/hybrid), and greeter (**multi-claim** open sign-up, in-person/hybrid).

Jesse named this directly (session 142): *"there are multiple hubs that share the schedule… they all use the scheduler in different ways, so let's make sure that we're always considering this when we're doing updates to any of them. Does this need to propagate throughout them all? Does it accidentally pollute the other ones with unnecessary features and triggers?"*

## The rule

When changing a shared surface, audit the change in **both directions before shipping**:

1. **Propagation — does it need to reach the others?** A capability added for one consumer is usually wanted by the siblings that share its shape. (Single-slot hubs share host-team's row shapes — "covered" / "needs-host" / "needs-sub" — so a single-slot affordance reaches AV + peer-led automatically. Confirm the *route gate* is scoped to the resource's hub, not hardcoded to one hub, or the others silently can't use it.)
2. **Pollution — does it bleed into the consumer that works differently?** The model that's *different* (greeter's multi-claim open sign-up) must not inherit affordances/triggers built for the single-slot model. Verify the differently-behaving consumer renders through its own path and the new affordance is gated to the path it belongs to.

## What this looked like in session 142

- **Propagation done right:** coordinator coverage actions (remove / reassign / clear-request) gate on `isManager || isHubCoordinator(resource.hubSlug)` — so AV and peer-led coordinators get them automatically, scoped to their own hub. No host-team hardcoding.
- **Pollution avoided (verified in code, not assumed):** those single-slot affordances live in the `"covered"` / `"needs-sub"` case branches; a greeter session always resolves to `kind === "multi"` (it carries a `claimants` array — see `rowKind`), so they *cannot* render on greeter rows. Greeter has its own affordances (sign-up / cancel-my-signup / per-claimant Remove) and no sub-request flow.
- **The over-reach I shipped, then scoped:** "No host needed" (`Program.hostingRequired`) initially excluded a program from *every* hub's coverage, not just the primary host. Jesse's multi-hub question surfaced it; it was scoped to the primary host only (auxiliary AV/greeter coverage stays independent). The view, the rotation engine, AND the mutation guards all had to agree — a partial fix would have produced "shows in the AV scheduler but the POST refuses to staff it" (the ship-5 reviewer's exact finding).

## How to apply it

Before shipping a Scheduler (or any shared-surface) change, ask explicitly:
- Which consumers share this surface, and how does each one differ? (For the Scheduler: `Hub.allowsMultipleAssignments`, `Hub.appliesToFormats`, single-slot vs multi-claim render path.)
- Does the route gate route by the *resource's* hub, or is it hardcoded?
- For a new affordance/trigger: which render path / `kind` does it attach to, and is that path reachable for the differently-behaving consumer?
- When a flag changes what's *shown*, do the *mutation guards* and any *background engine* (e.g. the rotation cron) agree with it? Show-but-can't-act is a classic split.

`RIM_Scheduler.md` holds the Scheduler-specific facts (the four hubs, the modes, the role model). This memory holds the *habit*: shared surface → audit propagation + pollution, every time.
