#!/usr/bin/env node
// Архітектурне правило «кожна server action першою дією перевіряє сесію».
// Кожна server action (експорт файлу з "use server" чи функція з директивою "use server" усередині) — публічний POST-
// ендпойнт: її можна викликати без сторінки. Тому ПЕРШИЙ оператор її тіла має викликати getViewer() або requireRole()
// з @/lib/supabase/viewer: вони викликають supabase.auth.getClaims() (перевіряє підпис JWT) і повертають клієнт Supabase
// цього користувача, тож жодного запиту до бази й жодного побічного ефекту без підписаної сесії. Роль перевіряє база
// (RLS, функції): скрипт її не бачить, а лише те, що сесію не пропущено.
// Розбір — компілятором TypeScript (AST), а не регулярними виразами: типи в сигнатурі, імена з `$`, багаторядкові
// сигнатури й рядки з дужками його не збивають.
// Порушення:
//  - перший оператор тіла не є викликом getViewer/requireRole (імпортованих з @/lib/supabase/viewer), зокрема виклик під
//    `if`, у гілці, у виразі чи після будь-якого іншого коду;
//  - експорт "use server" файлу, який не є `export async function` (стрілка, клас, enum, `export { … }`, `export *`,
//    `export default <вираз>`, генератор); типи (`export type`, `interface`) дозволено;
//  - inline-директива "use server" у функції в будь-якому файлі — та сама вимога до першого оператора.
// Виняток — вхід і вихід (src/app/login/actions.ts: login, signOut): сесії ще немає або її знищують.
// Межі: route.ts (GET/POST) скрипт не перевіряє — у репо їх немає.
// Використання: node scripts/check-action-auth.mjs [--root <dir>]
// Код виходу: 0 — порушень немає, 1 — є порушення, 2 — немає чого перевіряти (немає src/).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";

const args = process.argv.slice(2);
const rootIdx = args.indexOf("--root");
const root = rootIdx >= 0 ? args[rootIdx + 1] : process.cwd();
const src = join(root, "src");
if (!existsSync(src)) {
  console.error(`check-action-auth: у ${root} немає src/ — вкажіть --root <корінь проєкту>.`);
  process.exit(2);
}

// «файл:функція» — без перевірки сесії за призначенням.
const EXEMPT = new Set(["src/app/login/actions.ts:login", "src/app/login/actions.ts:signOut"]);
const AUTH_FUNCTIONS = new Set(["getViewer", "requireRole"]);
const VIEWER_MODULE = /^(?:@\/lib\/supabase|(?:\.\.?\/)+(?:lib\/)?supabase)\/viewer$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.[cm]?[jt]sx?$/.test(name)) out.push(full);
  }
  return out;
}

const hasUseServer = (statements) =>
  statements.some((s) => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === "use server");

/** Локальні імена getViewer/requireRole, імпортовані з модуля viewer (з урахуванням `as`). */
function authNames(sf) {
  const names = new Set();
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier) || !VIEWER_MODULE.test(s.moduleSpecifier.text)) continue;
    const bindings = s.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const el of bindings.elements) if (AUTH_FUNCTIONS.has((el.propertyName ?? el.name).text)) names.add(el.name.text);
  }
  return names;
}

/** Перший оператор тіла (після директив) — `await getViewer()`, `const … = await requireRole(…)` тощо. */
function firstStatementChecksSession(body, names) {
  const first = body.statements.find((s) => !(ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression)));
  if (!first) return false;
  let expr;
  if (ts.isVariableStatement(first)) expr = first.declarationList.declarations[0]?.initializer;
  else if (ts.isExpressionStatement(first)) expr = first.expression;
  while (expr && (ts.isAwaitExpression(expr) || ts.isParenthesizedExpression(expr))) expr = expr.expression;
  return !!expr && ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && names.has(expr.expression.text);
}

const problems = [];
let actions = 0;

for (const file of walk(src)) {
  const shown = file.split(sep).join("/").slice(root.split(sep).join("/").length + 1);
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const report = (node, message) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    problems.push(`${shown}:${line + 1}  ${message}`);
  };
  const names = authNames(sf);
  const checked = new Set();
  const check = (node, name) => {
    checked.add(node);
    actions++;
    if (EXEMPT.has(`${shown}:${name}`)) return;
    if (!node.body || !ts.isBlock(node.body) || !firstStatementChecksSession(node.body, names)) {
      report(node, `${name}: першим оператором має бути виклик getViewer()/requireRole() з @/lib/supabase/viewer — сесію не перевірено`);
    }
  };

  if (hasUseServer(sf.statements)) {
    for (const s of sf.statements) {
      const exported = ts.canHaveModifiers(s) && ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const isDefault = ts.canHaveModifiers(s) && ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (ts.isExportAssignment(s)) report(s, "експорт має бути `export async function`, тут — export default <вираз>");
      else if (ts.isExportDeclaration(s) && !s.isTypeOnly) report(s, "експорт має бути `export async function`, тут — export { … } чи export *");
      else if (exported && ts.isFunctionDeclaration(s)) {
        const isAsync = ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
        const name = isDefault ? "default" : (s.name?.text ?? "<anonymous>");
        if (!isAsync || s.asteriskToken) report(s, `${name}: експорт має бути \`export async function\` (не генератор і не синхронна)`);
        else check(s, name);
      } else if (exported && (ts.isVariableStatement(s) || ts.isClassDeclaration(s) || ts.isEnumDeclaration(s) || ts.isModuleDeclaration(s))) {
        report(s, "експорт має бути `export async function`, тут — змінна, клас, enum чи namespace");
      }
    }
  }

  // Inline-директиви: функція з "use server" усередині. Експорти файлу з директивою вище вже перевірено.
  const visit = (node) => {
    if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) && node.body && ts.isBlock(node.body)) {
      if (hasUseServer(node.body.statements) && !checked.has(node)) {
        const name = (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ? node.name?.text : undefined) ?? "<inline action>";
        check(node, name);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (problems.length) {
  console.error(`check-action-auth: порушень — ${problems.length}:\n${problems.map((p) => "  " + p).join("\n")}`);
  process.exit(1);
}
console.log(`check-action-auth: OK — server actions: ${actions}, кожна першим оператором перевіряє сесію (getViewer/requireRole).`);
