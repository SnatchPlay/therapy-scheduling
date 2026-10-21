---
name: visual-verify
description: "Use to verify a UI change in a real browser before calling it done: screenshots per role (admin / scheduler / therapist / signed out), the loading, empty and error states, light and dark theme. Required for any change that alters rendered output. Not needed for backend-only, docs-only or pure-logic changes."
user-invocable: true
---

# Visual verification

Type checks and unit tests do not prove a screen works. If the change alters what renders, observe
it in a browser, in every role that can see it.

## The loop

1. `npm run dev` (against your own Supabase project) or a Vercel preview of the PR.
2. Open the page in the built-in browser pane (or Playwright MCP / Claude in Chrome).
3. For each role that can see the page (the roles in `requirements/product.md` that exist in
   `public.profiles`), and signed out:
   - sign in with the synthetic `*@example.test` account (password: `DEMO_USER_PASSWORD`, typed by
     the developer, never by the agent and never in a screenshot);
   - screenshot **before** the action, drive the action, screenshot **after**;
   - open the forbidden pages by direct URL: the page must refuse, not just hide a button.
4. **Look at every screenshot.** If the screen did not change the way the acceptance criterion
   says, stop and investigate. An unread screenshot is not verification.

## What to check

- The exact texts from the acceptance criteria (statuses, messages) — character for character.
- Loading, empty and error states: force each one (empty day, no clients, a refused action).
- Times in `YYYY-MM-DD HH:mm`, America/Los_Angeles.
- Light and dark theme (DevTools → Rendering → `prefers-color-scheme`), mobile width for tables.
- No passwords, no real names, no e-mails outside `example.test` in any frame.

## Evidence

Screenshots that are part of the record go to `docs/img/` with a descriptive name and are linked
from the PR. Scratch screenshots stay out of git.

## Checklist

- [ ] every affected role, plus signed out
- [ ] forbidden page opened by direct URL
- [ ] loading / empty / error observed
- [ ] light and dark; mobile width if there is a table
- [ ] screenshots inspected, differences explained
