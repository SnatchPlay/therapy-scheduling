import { describe, expect, it } from "vitest";
import { AMBIENT, AT_LOGIN, cueForNavigation, restingState, SmokeTimeline } from "./timeline";

// Хореографія хреста з диму без браузера: стан у будь-який момент — sample(час у мс).
const COVERED = { scale: 10, alpha: 1, front: true };

describe("cueForNavigation", () => {
  it.each([
    ["/login", "/", "enter"],
    ["/login", "/slots", "enter"],
    ["/slots", "/login", "arrive"],
    ["/slots", "/holds", null],
    ["/login", "/login", null],
  ])("%s → %s: %s", (from, to, cue) => {
    expect(cueForNavigation(from, to)).toBe(cue);
  });

  it("стан спокою: на сторінці входу хрест помітний, на робочих сторінках — ледь", () => {
    expect(restingState("/login")).toBe(AT_LOGIN);
    expect(restingState("/clients/new")).toBe(AMBIENT);
    expect(AMBIENT.alpha).toBeLessThan(AT_LOGIN.alpha);
    // Контраст тексту з димом у DESIGN.md (розділ 11) пораховано для alpha 0.1.
    expect(AMBIENT.alpha).toBeLessThanOrEqual(0.1);
  });
});

describe("SmokeTimeline", () => {
  it("emerge: хрест плавно виходить з фону й лишається попереду, доки вхід триває", () => {
    const t = new SmokeTimeline(AT_LOGIN);
    t.play("emerge", 1000);
    expect(t.sample(1000)).toEqual(AT_LOGIN);
    const mid = t.sample(1450);
    expect(mid.alpha).toBeGreaterThan(AT_LOGIN.alpha);
    expect(mid.alpha).toBeLessThan(1);
    expect(t.sample(1900)).toEqual({ scale: 1.25, alpha: 1, warp: 0.14, front: false });
    expect(t.sample(60_000)).toEqual(t.sample(1900));
  });

  it("rest посеред emerge: хрест повертається у фон з того місця, де був, без стрибка", () => {
    const t = new SmokeTimeline(AT_LOGIN);
    t.play("emerge", 0);
    const before = t.sample(300);
    t.play("rest", 300);
    expect(t.sample(300)).toEqual(before);
    expect(t.sample(900)).toEqual(AT_LOGIN);
  });

  it("rest без emerge нічого не робить: перше відкриття сторінки входу й повернення після виходу", () => {
    const fresh = new SmokeTimeline(AT_LOGIN);
    fresh.play("rest", 0);
    expect(fresh.sample(0)).toEqual(AT_LOGIN);

    const t = new SmokeTimeline(AMBIENT);
    t.play("summon", 0);
    t.play("arrive", 500);
    t.play("rest", 600); // кнопка входу змонтувалась на новій сторінці
    expect(t.sample(1450)).toMatchObject(COVERED);
    expect(t.sample(1450 + 1500)).toEqual(AT_LOGIN);
  });

  it("rest після enter (вхід удався) не повертає хрест на сторінку входу", () => {
    const t = new SmokeTimeline(AT_LOGIN);
    t.play("emerge", 0);
    t.play("enter", 300);
    t.play("rest", 310);
    expect(t.sample(300 + 1900)).toEqual(AMBIENT);
  });

  it("enter: хрест перекриває екран над вмістом, тоді розсіюється в ледь помітне тло застосунку", () => {
    const t = new SmokeTimeline(AT_LOGIN);
    t.play("enter", 0);
    expect(t.sample(650)).toMatchObject(COVERED);
    // Розсіявся над вмістом — і вже прозорим іде під вміст.
    expect(t.sample(1099)).toMatchObject({ front: true });
    expect(t.sample(1099).alpha).toBeLessThan(0.01);
    expect(t.sample(1100)).toEqual({ ...AMBIENT, alpha: 0 });
    expect(t.sample(1100 + 800)).toEqual(AMBIENT);
  });

  it("summon: сторінка входу відкрилась раніше — хрест однаково долітає й перекриває екран, і лише тоді відступає у фон", () => {
    const t = new SmokeTimeline(AMBIENT);
    t.play("summon", 0);
    expect(t.sample(0)).toMatchObject({ alpha: 0, front: true });
    t.play("arrive", 500); // відповідь сервера прийшла посеред анімації
    const covered = 900 + 550;
    expect(t.sample(covered)).toMatchObject(COVERED);
    expect(t.sample(covered + 300).front).toBe(true);
    expect(t.sample(covered + 600 + 450).front).toBe(false);
    expect(t.sample(covered + 1500)).toEqual(AT_LOGIN);
  });

  it("settle: вихід упав, коли хрест перекрив екран — одразу під вміст і за 600 мс у стан сторінки, без черги", () => {
    const t = new SmokeTimeline(AMBIENT);
    t.play("summon", 0);
    t.play("arrive", 100);
    t.settle(AMBIENT, 1450);
    expect(t.sample(1450)).toMatchObject({ ...COVERED, front: false });
    expect(t.sample(2050)).toEqual(AMBIENT);
    expect(t.endsAt).toBe(2050);
    t.play("emerge", 2100); // черги summon більше немає
    expect(t.sample(2100)).toEqual(AMBIENT);
  });

  it("подвійний клік на Sign out не запускає хрест удруге", () => {
    const t = new SmokeTimeline(AMBIENT);
    t.play("summon", 0);
    const end = t.endsAt;
    t.play("summon", 200);
    expect(t.endsAt).toBe(end);
    expect(t.sample(1450)).toMatchObject(COVERED);
  });

  it("endsAt: після кінця анімації стан сталий — досить одного кадру", () => {
    const t = new SmokeTimeline(AT_LOGIN);
    t.play("enter", 1000);
    expect(t.endsAt).toBe(1000 + 650 + 450 + 800);
    expect(t.sample(t.endsAt)).toEqual(t.sample(t.endsAt + 10_000));
  });

  it("jump (без руху): одразу стан сторінки, без черги незавершеної анімації", () => {
    const t = new SmokeTimeline(AMBIENT);
    t.play("summon", 0);
    t.jump(AT_LOGIN);
    expect(t.sample(10)).toEqual(AT_LOGIN);
    t.play("emerge", 20);
    expect(t.sample(20)).toEqual(AT_LOGIN);
  });
});
