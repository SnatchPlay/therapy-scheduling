// Ролі UAT: стан входу з tests/e2e/auth.setup.ts (playwright/.auth/<роль>.json) і перемикання між ролями в одному тесті.
import { readFileSync } from "node:fs";
import { test, type Browser, type Cookie, type Page } from "@playwright/test";

// Роль → адреса акаунта на проді (D0.5, *@example.test): вхід у auth.setup.ts, перевірка шапки в тестах.
export const ROLES = {
  scheduler: "scheduler1@example.test",
  therapist: "therapist1@example.test",
  therapist2: "therapist2@example.test",
} as const;
export type Role = keyof typeof ROLES;

export const authFile = (role: Role) => `playwright/.auth/${role}.json`;

/** Читання «з іншого боку» (дані власника, лічильники) у другій сесії: без запису, закривається завжди. */
export async function withRole<T>(browser: Browser, role: Role, body: (page: Page) => Promise<T>): Promise<T> {
  const { baseURL, locale, timezoneId, reducedMotion } = test.info().project.use;
  const context = await browser.newContext({ baseURL, locale, timezoneId, reducedMotion, storageState: authFile(role) });
  try {
    return await body(await context.newPage());
  } finally {
    await context.close();
  }
}

/** Та сама сторінка (і те саме відео) далі від імені іншої ролі: cookie сесії замінюємо на збережені для ролі. */
export async function switchRole(page: Page, role: Role) {
  const { cookies } = JSON.parse(readFileSync(authFile(role), "utf8")) as { cookies: Cookie[] };
  await page.context().clearCookies();
  await page.context().addCookies(cookies);
}
