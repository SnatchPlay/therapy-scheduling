// Гонка двох утримань на справжньому Postgres (AC-HOLD-04, AC-HOLD-25). PGlite має одне з'єднання, тож тести бази
// перевіряють лише послідовні спроби; тут — дві сесії psql одночасно: перша тримає транзакцію відкритою, друга мусить
// дочекатися її замка (слот або клієнт) і отримати відмову.
// Запуск: node scripts/check-hold-race.mjs після `supabase db start` (контейнер supabase_db_<project_id>; інший — DB_CONTAINER).
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync("supabase/config.toml", "utf8"))?.[1];
const container = process.env.DB_CONTAINER ?? `supabase_db_${projectId}`;
const HOLD_SECONDS = 5; // скільки перша сесія тримає замок
const START_DELAY_MS = 2000; // коли стартує друга: перша вже вставила утримання й тримає замок
const MIN_WAIT_MS = 1500; // друга має чекати на замок хоча б стільки, інакше вона відмовила не через замок

const psql = (sql) =>
  new Promise((resolve) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"]);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
    child.stdin.end(sql);
  });

const tag = `race-${Date.now()}`;
const id = () => randomUUID();
const [schedulerA, schedulerB, therapist1, therapist2] = [id(), id(), id(), id()];
const [slotSame, slotX, slotY] = [id(), id(), id()];
const [client1, client2, client3] = [id(), id(), id()];
const hourAt = (days, extraHours = 0) => `date_trunc('hour', now()) + interval '${days} days' + interval '${extraHours} hours'`;

const setup = `
insert into auth.users (id, email, raw_user_meta_data) values
  ('${schedulerA}', 'scheduler-a-${tag}@example.test', '{}'), ('${schedulerB}', 'scheduler-b-${tag}@example.test', '{}');
update public.profiles set role = 'scheduler' where id in ('${schedulerA}', '${schedulerB}');
insert into public.therapists (id, email, full_name) values
  ('${therapist1}', 'therapist-1-${tag}@example.test', 'Race One'), ('${therapist2}', 'therapist-2-${tag}@example.test', 'Race Two');
insert into public.slots (id, therapist_id, starts_at, ends_at) values
  ('${slotSame}', '${therapist1}', ${hourAt(30)}, ${hourAt(30)} + interval '60 minutes'),
  ('${slotX}', '${therapist1}', ${hourAt(30, 3)}, ${hourAt(30, 3)} + interval '60 minutes'),
  ('${slotY}', '${therapist2}', ${hourAt(30, 3)}, ${hourAt(30, 3)} + interval '60 minutes');
insert into public.clients (id, full_name, email, birth_date, session_language, created_by) values
  ('${client1}', 'Race Client 1', 'client-1-${tag}@example.test', date '1990-01-01', 'English', '${schedulerA}'),
  ('${client2}', 'Race Client 2', 'client-2-${tag}@example.test', date '1990-01-01', 'English', '${schedulerA}'),
  ('${client3}', 'Race Client 3', 'client-3-${tag}@example.test', date '1990-01-01', 'English', '${schedulerA}');
`;

// Як server action: роль authenticated і claims користувача; транзакцію тримаємо відкритою до pg_sleep.
const holdSession = ({ user, slot, client }, sleepSeconds) => `
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated"}', true);
select public.hold_slot('${slot}', '${client}');
select pg_sleep(${sleepSeconds});
commit;
`;

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
  if (!ok) failures.push(message);
};

async function race(name, a, b, expectedError, countSql, expectedCount) {
  console.log(`\n${name}`);
  const first = psql(holdSession(a, HOLD_SECONDS));
  await new Promise((r) => setTimeout(r, START_DELAY_MS));
  const startedB = Date.now();
  const second = await psql(holdSession(b, 0));
  const waitedMs = Date.now() - startedB;
  const firstResult = await first;

  check(firstResult.code === 0, "перша сесія створила утримання");
  check(second.code !== 0 && second.err.includes(expectedError), `друга сесія отримала ${expectedError} (код ${second.code}, ${second.err.split("\n")[0] || "без помилки"})`);
  check(waitedMs >= MIN_WAIT_MS, `друга сесія чекала на замок першої ${waitedMs} мс (потрібно не менше ${MIN_WAIT_MS})`);
  const count = await psql(countSql);
  check(count.out === String(expectedCount), `активних утримань: ${count.out} (потрібно ${expectedCount})`);
}

try {
  const ready = await psql(setup);
  if (ready.code !== 0) throw new Error(`не вдалося підготувати дані: ${ready.err}`);

  await race(
    "AC-HOLD-04: два планувальники одночасно утримують один слот",
    { user: schedulerA, slot: slotSame, client: client1 },
    { user: schedulerB, slot: slotSame, client: client2 },
    "SLOT_UNAVAILABLE",
    `select count(*) from public.holds where slot_id = '${slotSame}'`,
    1,
  );
  await race(
    "AC-HOLD-25: один клієнт одночасно на двох слотах одного часу в різних терапевтів",
    { user: schedulerA, slot: slotX, client: client3 },
    { user: schedulerB, slot: slotY, client: client3 },
    "CLIENT_OVERLAP",
    `select count(*) from public.holds where client_id = '${client3}'`,
    1,
  );
} finally {
  const cleanup = await psql(`
    delete from public.therapists where id in ('${therapist1}', '${therapist2}');
    delete from public.clients where id in ('${client1}', '${client2}', '${client3}');
    delete from auth.users where id in ('${schedulerA}', '${schedulerB}');
  `);
  if (cleanup.code !== 0) console.error(`Не вдалося прибрати тестові дані (${tag}): ${cleanup.err}`);
}

if (failures.length > 0) {
  console.error(`\nГонка утримань: ${failures.length} перевірок не пройдено.`);
  process.exit(1);
}
console.log("\nГонка утримань: усе гаразд.");
