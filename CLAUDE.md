@AGENTS.md

- Мова відповідей і документації — українська; код, команди й імена файлів — англійською.
- Скіли: `.claude/skills/` (spec-clarify, spec-review, openspec-*); команди: `/requirements-sync`, `/conformance`, `/opsx:*`.
- Перед роботою над зрізом прочитай шапку й таблицю `docs/conformance.md` (звідки й коли знімок вимог PM), вимоги зрізу в `requirements/` і активну зміну в `openspec/changes/` (`add-<зріз>` — специфікація, `impl-<зріз>` — план).
- Перевірка змін — `docs/reference/validation.md` (gate, рев'ю за областями, quality trial у `.quality-trial/`). Скіли якості: `code-craft`, `self-review`, `ponytail-review`, `rls-migration`, `visual-verify` (`.claude/skills/`).
