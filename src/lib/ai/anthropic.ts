import "server-only"; // помилка збірки, якщо цей файл колись імпортує Client Component
import { makeProductModel } from "./models";

// Ключ ANTHROPIC_API_KEY — ваш ключ Claude API (платний, ADR 0008):
//   локально — у .env.local (він у .gitignore); у проді — Vercel → Project Settings → Environment Variables.
// НІКОЛИ не з префіксом NEXT_PUBLIC_: такі значення вбудовуються в JavaScript для браузера.
// Цей файл — єдине місце в src/, яке читає ключ (це перевіряє tests/ai-key.test.ts).
// Немає ключа (або лише пробіли) → null: функція з AI вимикається, а ручна форма працює далі.
export function productModel() {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? makeProductModel(key) : null;
}
