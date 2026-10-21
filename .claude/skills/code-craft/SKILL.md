---
name: code-craft
description: The design review a senior engineer runs on their own work. Use PROACTIVELY before committing, before opening a PR, before saying a change is done, and whenever adding a helper, utility, class, module, validation, mapping or constant. Catches what type checkers and correctness review cannot - duplicated knowledge, code that belongs somewhere else, reinventing what a dependency already provides, vague failure contracts, and diffs too large to review. Not for finding bugs (use code review for that), not for formatting or naming nits.
user-invocable: true
---

# Code craft

You are reviewing your own work the way a senior engineer reviews a colleague's: looking for
what will cost the team later, not for what is wrong right now. A type checker proves the code
is consistent. This asks whether it should exist in this shape at all.

Work through the three moments below. Skip a question only when you can say why it does not apply.

## Before you write

**Search first, and count.** Before adding a function, helper, client, constant, hook or module,
search the repository for something that already does it. Search by behaviour and by shape, not
just by name - an equivalent may be spelled differently. Then state what you found:

> Searched `toNullableNumber|parseNullableNumber|asNumber`, `Number(` in mappers - found 2 existing
> implementations in `x.ts` and `y.ts`. Extending `x.ts`.

If you found equivalents and are still adding a new one, justify it in one sentence. "I did not
find one" is only credible if you name what you searched for.

**Ask the platform before hand-rolling.** Validation, parsing, coercion, retry, transport,
pagination, serialisation, date handling, auth plumbing - these are usually solved by a dependency
you already have. Check the installed package's exported API before writing your own. Coercing a
value the framework already coerces, or validating a format the library already validates, is
code the team maintains forever for nothing.

**Ask where it belongs.** Open the directory you are about to write into and ask what its name
tells a reader who has never seen this repository. If the answer is unclear, or if analogous code
consistently lives one level up, the file is probably in the wrong place. Small utilities scattered
across feature folders are a sign the pool they belong to does not exist yet.

## While you write

**One reason to change.** A module should have a single reason to change. Transport concerns
(base URL, headers, request construction, error mapping) do not belong in a class whose job is one
entity - extract them once and let the entity class own only what is specific to that entity. If
you can honestly say "this changes when the database changes, *or* when the API changes, *or* when
the business rule changes", it is doing too much.

**Scope constants where they apply.** A limit that governs the whole API is not an entity-level
constant. Placing it locally guarantees it will be re-declared differently elsewhere.

**Fail loudly.** When absence is an error, throw a named error. Returning `null` or an empty list
for a real failure pushes the decision to a caller who has less information than you do, and it
looks identical to a legitimate empty result.

**Do not write what nobody will read.** Comments restating the code, documentation duplicating what
a schema or introspection endpoint already answers, and prose added to instruction files all create
maintenance burden and consume context on every future task. Write a comment when it explains a
*why* that the code cannot. Otherwise write none.

## Before you call it done

**Change locality.** Pick the main rule or concept this change introduces. If it changed tomorrow,
how many files would you edit? List them. More than one means the knowledge is spread, whatever the
code looks like - and the second copy will drift.

**Replacement means removal.** If this change supersedes something, the old path goes in the same
change: callers, exports, styles, tests, docs. Two live versions of one thing is an unfinished task.

**Reviewability.** Can one person hold this diff in their head in a single sitting? If not, split it
into stacked changes that each stand alone. A change too large to review is approved, not reviewed.

**Ownership.** If you added a capability rather than changed one, ask whether this team should own it
at all - whether another team, an existing tool, or a vendor already owns that problem. Everything
added here is maintained here for the rest of its life. This question is for a human; raise it rather
than answer it.

## Evidence bar

A finding you raise about your own work needs all of:

- **Location** - `path:line`.
- **What is wrong** - the specific defect, not a category.
- **Why it matters** - the concrete cost, to whom, when.
- **The fix** - the smallest change that removes the cause.
- **The strongest counterargument** - the best case that this is fine as written.

If the counterargument holds, drop the finding. A finding that survives its own best rebuttal is
worth raising; one that does not is noise.

## Not a finding

Do not raise, and do not restructure code for:

- A long function or a large file, on its own. Size is a hint to look, never the finding itself.
- Two or three lines that look similar. Duplicated text is not duplicated knowledge.
- Naming or structure you would have chosen differently, where the existing choice is consistent.
- A missing abstraction with exactly one caller.
- An escape hatch - raw SQL, a cast, a manual loop - where the higher-level tool genuinely cannot
  express the need and the reason is stated.
- Formatting, import order, or anything a formatter owns.

## Report

State the outcome plainly, in this order. Empty is not allowed; `N/A - <reason>` is.

    Reuse:     what you searched, what you found, what you did about it
    Locality:  the rule this change introduces, and how many places own it
    Removed:   what this replaced and where the old path went
    Shortcuts: anything you knowingly left imperfect, and why
    Not done:  what you noticed and deliberately did not touch

`Shortcuts` and `Not done` are the point of this report. They turn a silent compromise into a
decision someone can review.
