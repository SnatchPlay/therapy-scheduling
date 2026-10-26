#!/usr/bin/env node
// npm run users:demo — створює синтетичних користувачів із supabase/demo-users.json через Admin API
// і ставить їм роль у public.profiles. Ідемпотентно: наявних користувачів не дублює, а оновлює
// їм пароль, ім'я та роль.
//
// Потрібні змінні (npm run users:demo читає .env.local через `node --env-file`):
//   NEXT_PUBLIC_SUPABASE_URL  — адреса проєкту;
//   SUPABASE_SECRET_KEY       — секретний ключ (sb_secret_…), лише на сервері, ніколи NEXT_PUBLIC_;
//   DEMO_USER_PASSWORD        — один пароль для всіх демо-користувачів (≥ 8 символів), не комітиться.
// Параметри: `--file <шлях>` — інший список користувачів (за замовчуванням supabase/demo-users.json); `--password-env <ІМ'Я>` —
// змінна з паролем цього списку (за замовчуванням DEMO_USER_PASSWORD). Так PM отримує власні акаунти з власним паролем
// (npm run users:pm), а паролі демо-акаунтів не міняються.
// Чому скрипт, а не реєстрація: вбудований SMTP Supabase надсилає 2 листи/год і лише членам команди проєкту в Supabase,
// тому email-підтвердження в навчальних проєктах вимкнено, а користувачів створюємо тут (email_confirm: true).
// Скрипт ніколи не друкує значення ключів і паролів.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

let values;
try {
  ({ values } = parseArgs({ options: { file: { type: "string" }, "password-env": { type: "string" } }, strict: true }));
} catch (e) {
  console.error(`Некоректні параметри (${e.message}). Дозволено: --file <шлях> --password-env <ІМ'Я>.`);
  process.exit(2);
}
// Власний список користувачів без власного пароля отримав би пароль демо-акаунтів, який знає вся команда.
if (values.file && !values["password-env"]) {
  console.error("З --file потрібен і --password-env <ІМ'Я>: пароль цього списку не має збігатися з DEMO_USER_PASSWORD.");
  process.exit(2);
}
const passwordVar = values["password-env"] ?? "DEMO_USER_PASSWORD";
const usersFile = values.file ?? path.join("supabase", "demo-users.json");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const password = process.env[passwordVar];

const missing = [
  ["NEXT_PUBLIC_SUPABASE_URL", url],
  ["SUPABASE_SECRET_KEY", secretKey],
  [passwordVar, password],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);
if (missing.length) {
  console.error(`Не задано: ${missing.join(", ")}. Додайте їх у .env.local (див. .env.example).`);
  process.exit(1);
}
if (password.length < 8) {
  console.error(`${passwordVar} має бути не коротшим за 8 символів.`);
  process.exit(1);
}

const file = path.resolve(process.cwd(), usersFile);
const users = JSON.parse(readFileSync(file, "utf8"));
for (const u of users) {
  if (!/^[^@\s]+@example\.test$/i.test(u.email ?? "")) {
    console.error(`Лише синтетичні адреси *@example.test: "${u.email}" у ${usersFile}.`);
    process.exit(1);
  }
  // "role": null — користувач без ролі (AC-CARD-11); ключ має бути явним, щоб не забути роль випадково.
  if (!("role" in u)) {
    console.error(`Для ${u.email} не вказано role (null — без ролі).`);
    process.exit(1);
  }
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 1000) return null;
  }
}

let failed = 0;
for (const u of users) {
  try {
    let id;
    let action;
    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name ?? null },
    });
    if (!error) {
      id = data.user.id;
      action = "створено";
    } else if (["email_exists", "user_already_exists"].includes(error.code ?? "") || /already/i.test(error.message)) {
      id = await findUserId(u.email);
      if (!id) throw new Error(`користувач існує, але не знайдений через listUsers`);
      const { error: updateError } = await supabase.auth.admin.updateUserById(id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name ?? null },
      });
      if (updateError) throw updateError;
      action = "оновлено";
    } else {
      throw error;
    }

    // Профіль створює тригер on_auth_user_created; upsert робить крок ідемпотентним
    // і ставить роль (колонку role змінює лише service_role — див. міграцію).
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id, email: u.email, full_name: u.full_name ?? null, role: u.role }, { onConflict: "id" });
    if (profileError) throw profileError;

    console.log(`✔ ${u.email} — ${action}, роль ${u.role ?? "немає"}`);
  } catch (e) {
    failed++;
    console.error(`✖ ${u.email}: ${e.message ?? e}`);
  }
}

if (failed) {
  console.error(
    `\nПомилок: ${failed}. Перевірте, що міграції застосовано (job db-deploy у CI) і ключ — секретний (sb_secret_…).`,
  );
  process.exit(1);
}
console.log(`\nГотово, користувачів: ${users.length}. Пароль — значення ${passwordVar} (у консоль не виводимо).`);
