---
name: coordinator-is-hub-manager
description: "A hub coordinator holds the FULL coverage-management authority for their own hub — assign/remove/reassign/clear/request-sub, hub-scoped — not a lesser tier than HOST_MANAGER/ADMIN"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3a779db0-ad24-446a-be45-560f5067623e
---

A hub coordinator carries responsibility for their own team's coverage and should hold the **full** coverage-management authority within their hub — not a lesser tier than HOST_MANAGER/ADMIN. As of sessions 140–143 that means all of: assign a host, remove/unassign, reassign-to-me, clear a cover request, and request a sub on a host's behalf.

**Why:** `RIM_Role_Design.md` frames the host coordinator as the *team steward* — "be the go-to person, not Jesse." If a coordinator can put someone on a session, they can also take them off it, hand it to someone else, or ask the team to cover — the responsibility and the authority are the same thing. Splitting them (coordinator can assign but not remove) was the exact gap Nancy hit in session 140; session 142 closed remove/reassign/clear; session 143 closed the last one (request-sub-on-behalf).

**How to apply:** gate every coverage mutation on `isManager(roles) || isHubCoordinator(resource.hubSlug)`, scoped to the *resource's own hub* (the assignment's `hubSlug`, never a hardcoded hub) — so a coordinator only acts on their own team and there's no privilege escalation; a plain host still acts only on their own. Authorize per-action AFTER loading the resource so the gate can read its hub (the PATCH-unclaim shadowing bug, s142). The Scheduler is one surface shared by hubs that behave differently, so check both directions on any change — see [[feedback-shared-surface-audit]].
