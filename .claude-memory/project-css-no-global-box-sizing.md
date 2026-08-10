---
name: project-css-no-global-box-sizing
description: "webflow.css is no longer loaded, so there's no global `* { box-sizing: border-box }`; a width:100% form control overflows its padded container unless border-box is set — custom.css now carries an input/textarea/select reset"
metadata: 
  node_type: memory
  type: project
  originSessionId: d8c3da4f-5226-411f-bcf8-dcacefab4894
  modified: 2026-08-10T11:38:22.710Z
---

**The app loads only `public/css/custom.css`** now (see `app/layout.tsx` — `normalize.css`, `webflow.css`, and `rim.webflow.css` are NOT linked; this is the Webflow retirement). **`webflow.css` was what carried the global `* { box-sizing: border-box }` reset.** Without it, elements fall back to the browser default `content-box`.

**The trap:** any element with `width: 100%` **plus** padding/border overflows its container by exactly that padding + border. It bit us in session 166 — a comment `<textarea>` (and, Jesse noted, form fields in several other places) overhung its card. This is easy to reintroduce: a new full-width input/textarea/select looks fine in isolation but spills past a padded parent.

**The fix that's in place (s166):** `custom.css` now has a scoped reset:
```css
input, textarea, select { box-sizing: border-box; }
```
So form controls are safe. But **non-form elements still default to content-box** — if a `width:100%`+padding `<div>` overflows, add `box-sizing: border-box` explicitly (several component rules already do). Don't assume a global reset exists.

**The trap struck a third time, at the layout level (s172):** `.hub-ws-content` and `.tools-content` were `width:100% + padding` — every hub destination and tool page rendered viewport+padding wide and CLIPPED at the window edge at half-screen widths (`body { overflow-x: clip }` cuts silently, no scrollbar; Jesse: "a lot is cut off"). A deterministic sweep of all 98 backend `width:100%` rules found 16 live instances; all border-boxed in one grouped rule at the end of custom.css.

**How to apply:** any NEW `width: 100%` (or fixed-width) rule that also carries horizontal padding/border must declare `box-sizing: border-box` in the same rule, at birth — including layout containers, not just controls. Exceptions that self-rescue: flex items of a ROW container (flex-shrink absorbs the padding) and tables (cell padding is interior). When hunting a "content cut off at the right edge" report, this trap is suspect #1.

Verify against `public/css/custom.css` + `app/layout.tsx` before relying on this — reflects the s172 state.
