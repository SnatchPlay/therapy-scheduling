# Доказ: рядок `llm.call` у Runtime Logs Vercel (staging)

Один запит чернетки картки клієнта на staging, 2026-11-22 12:10:44 UTC: деплой `dpl_5SARUBKjkB5Jw7evakuhyfkmvgma`, гілка
`staging`, середовище preview, регіон `dub1`, маршрут `POST /clients/new`. Запит із синтетичним текстом звернення
(`*@example.test`). Рядок прочитано через Vercel (журнали живуть 1 годину) і скопійовано без змін:

```json
{"event":"llm.call","ts":"2026-11-22T12:10:44.099Z","requestId":"76b62508-9e56-4f26-bd51-ee9e2a1329ff","route":"/clients/new","model":"claude-haiku-5-5","fallbackUsed":false,"state":"ok","latencyMs":2341,"inputTokens":2487,"outputTokens":85,"promptVersion":"intake-v1"}
```

- Один рядок JSON на один виклик моделі.
- Поля лише з дозволеного списку (`src/lib/ai/llm-log.ts`): ні тексту звернення, ні імені, ні email, ні відповіді моделі.
- `fallbackUsed` завжди `false`: одна модель, без ланцюжка запасних (ADR 0008).
- Код: `src/lib/ai/draft.ts` (`askModel`), тест: `src/lib/ai/draft.test.ts`, `tests/llm-log.test.ts`.
