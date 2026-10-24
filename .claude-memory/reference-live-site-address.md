---
name: reference-live-site-address
description: Live checks run against rim-next.vercel.app; www.rootedinmindfulness.org still serves the old site
metadata:
  node_type: memory
  type: reference
  originSessionId: 8079f620-7103-4b9e-ac4f-3ff31ce43b34
  modified: 2026-10-24T12:50:00.459Z
---

Until the domain moves, this app is live at **https://rim-next.vercel.app**. `rootedinmindfulness.org` redirects to `www.rootedinmindfulness.org`, which is still the old site: new routes return 404 there and its `/css/custom.css` is not this repo's.

To confirm a deploy, poll `https://rim-next.vercel.app/css/custom.css` for a new rule, or GitHub's commit status for the Vercel check (`api.github.com/repos/jessefoy/rim-next/commits/<sha>/status`; the `gh` CLI isn't installed). On 2026-10-23 a ten-minute wait against the www domain reported "not deployed" when the deploy had succeeded.

Jesse is usually signed in to the built-in browser pane on rim-next.vercel.app, so signed-in pages can be checked there. Related: [[project-architecture-pivot]], [[feedback-check-live-test-side-effects]].
