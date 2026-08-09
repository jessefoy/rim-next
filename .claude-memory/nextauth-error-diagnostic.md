---
name: nextauth-error-diagnostic
description: NextAuth v5 email-provider error code translation — Configuration vs Verification. Collapses the diagnostic space when a user reports a sign-in error.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 14009c64-1d08-4530-89e6-4c872b51e835
---

In NextAuth v5 (RIM uses `next-auth@^5.0.0-beta.30`), the `/login/error?error=...` page receives one of a small set of error names from the email-provider callback at `/api/auth/callback/resend`. Two are relevant for the sign-in code flow and they mean *different* things:

- **`error=Configuration`** — `?token=` query param was missing or empty when the callback was hit. Thrown from `@auth/core/src/lib/actions/callback/index.ts:209-216`. NOT a generic "config is wrong" error despite the name. Means: the form submitted an empty token. Almost always a frontend/form bug, not a server config issue.

- **`error=Verification`** — token was present but didn't match what's in the `VerificationToken` table (wrong code, already used, or expired). The user-facing copy on `/login/error` calls this out specifically ("That code is invalid or has expired").

**Diagnostic rule:** if Jesse reports a sign-in error and the URL shows `error=Configuration`, look at the form first (hidden token field, ref sync, controlled vs uncontrolled). If it shows `error=Verification`, look at the token (expired, wrong digits, single-use already consumed).

**Why this matters:** the generic "An error occurred during sign in" copy on the error page only fires for non-Verification errors, including Configuration. That copy reads like a server hiccup, which sends debugging in the wrong direction. Knowing Configuration = empty-token-from-the-form short-circuits the investigation.

History: shipped fix in commit `1c3d019` (session 121 same-day follow-on) — hidden token field changed from uncontrolled (`defaultValue=""` + `ref.current.value = ...`) to controlled (`value={boxes.join("")} readOnly`). The uncontrolled pattern was drifting from React state under autofill, reconciliation, or early-submit, producing empty `?token=` submissions. See [[feedback-server-compute-caches]] for an analogous "derive from source, don't sync" principle in a different domain.
