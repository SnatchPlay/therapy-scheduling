---
name: self-review
description: Validate your own change before calling it done - run the project's gate, review the full change (including untracked files) with blind reviewers split by area, verify every finding against the code, and report with evidence. Use PROACTIVELY before declaring any non-trivial change done, before committing, and before opening a PR. Loads the project's validation rules first; they override this skill. Not a design review (use code-craft) and not a substitute for running the change.
user-invocable: true
---

# Self-review

You wrote the change, so you are the worst-placed reviewer of it: you read what you meant, not what
is there. This skill makes the review independent of your intent and every claim checkable.

## 0. Load the project's rules

Find the project's validation rules: the file its `CLAUDE.md` / `AGENTS.md` names (convention:
`docs/reference/validation.md`). It defines the gate commands, the review areas and the
project-specific checklists. Where it and this skill disagree, the project wins. No such file → use
the defaults here and say so in the report.

## 1. Gate

Run every command the project's gate lists (commands only - the review is §3), for every package the change touches, and record each
command with its real result. Know what each command actually checks - a green build is not a
type-check unless the build type-checks. A database, edge-function or service change is exercised
on the local stack the project describes; never verify by deploying.

## 2. Full scope

`git status --porcelain` - untracked files are part of the change and `git diff` alone misses them.
Size it with `git diff --shortstat HEAD` plus `git ls-files --others --exclude-standard -z | xargs -0
wc -l` for new files. Modified files: review the diff with its surrounding code. New files: review the whole file.
Deleted files: review what depended on them. Lockfiles and generated files: confirm they were
regenerated, do not review line by line.

## 3. Review - blind, split by area when large

- **Small** (roughly ≤ 15 files and ≤ 800 changed lines): one `code-review` at `high` on the full
  scope, with the checklists of every area it touches.
- **Larger:** split the scope by area - the project's area map, or by default: auth & access · data
  access & API · database & migrations · CI, infra & containers · UI. Tests go with the area of the
  code they test; a file no area matches goes to the nearest one and is named in the report. Launch
  one fresh subagent per area, in parallel, each running `code-review high` on only its files.
- **Checklists:** each area gets the sections of [checklists.md](checklists.md) the project assigns
  to it, plus the project's checks. Without a project mapping: the section of the same name, plus
  Tests wherever there are test files, plus Containers for CI & infra, plus Scripts & data fixes
  for scripts.
- **Explicit paths.** Pass every reviewer its file paths, new files included: a review of "the
  current diff" never sees untracked files.
- **Blind.** A reviewer gets the file list, the checklists and read access to the repository.
  Never your intent, your summary of the change, or where you think the risk is - that anchors it
  on what you already believe.
- No `code-review` skill available → the subagent reads the files and applies the checklists
  directly, with the same output format.

Ask every reviewer for: severity · `file:line` · one-sentence defect · concrete failure scenario ·
fix, plus files reviewed and anything skipped.

**Why split:** measured 2026-09-25 on a 65-file change - one reviewer found 5 real defects; the
same review split into 4 areas found 18, at about 60k tokens per area. Every run still missed
defects another run caught, a High among them.

## 4. Verify every finding

Open the cited lines yourself and mark each finding:

- **CONFIRMED** - you read the code (and ran it, where that is cheap) and the scenario holds;
- **PLAUSIBLE** - the code matches, but the scenario depends on runtime or a decision you did
  not check;
- **dropped** - it cannot be tied to a concrete line and a concrete failure.

"No defect found" is not evidence of absence: two reviewers given the same file have reached
opposite conclusions about it. Where a miss is expensive (auth, access control, migrations,
deletion, money), a second independent reviewer on that area is cheap insurance.

## 5. Fix or surface

Fix what is inside the agreed scope, then re-run the gate. Findings outside the scope are reported,
not fixed on the side.

## 6. Report

In this order:

1. Failures, and everything not run or not verified.
2. Findings: severity · `file:line` · defect · failure scenario · CONFIRMED/PLAUSIBLE · fixed or
   open.
3. Gate: each command with its result.
4. Scope: files and areas reviewed, what was excluded and why.
