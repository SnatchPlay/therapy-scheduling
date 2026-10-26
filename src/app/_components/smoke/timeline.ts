// Хрест з диму на тлі (DESIGN.md, розділ «Рух»): стани сцени й переходи між ними як функція часу. Рендер лише малює
// стан, який повертає sample(), тож уся хореографія — тут і перевіряється тестами без браузера.

export type SmokeState = {
  /** Розмір хреста: 1 — на тлі сторінки входу, ≥ 10 — хрест перекриває весь екран. */
  scale: number;
  /** Непрозорість диму, 0–1. */
  alpha: number;
  /** Наскільки дим розмиває форму хреста: 0 — чіткий, > 1 — лише клуби диму. */
  warp: number;
  /** Над вмістом сторінки (true) чи під ним. */
  front: boolean;
};

type Numbers = Omit<SmokeState, "front">;
type Ease = (x: number) => number;
type Step = { to: Partial<Numbers>; ms: number; ease?: Ease; front?: boolean };
type Keyframe = { at: number; state: SmokeState; ease: Ease };

export type Cue = "emerge" | "rest" | "enter" | "summon" | "arrive";

const linear: Ease = (x) => x;
const easeOut: Ease = (x) => 1 - (1 - x) ** 3;
const easeIn: Ease = (x) => x ** 3;

export const AT_LOGIN: SmokeState = { scale: 1, alpha: 0.5, warp: 0.22, front: false };
// На робочих сторінках ледь помітно: вимога PM «інтерфейс не має відволікати».
export const AMBIENT: SmokeState = { scale: 1.6, alpha: 0.1, warp: 0.3, front: false };
const COVER: Numbers = { scale: 10, alpha: 1, warp: 0.5 };

const CUES: Record<Cue, { steps: Step[]; finish?: boolean }> = {
  // Натиснули Sign in: хрест виринає з фону — ближче, яскравіше, чіткіше.
  emerge: { steps: [{ to: { scale: 1.25, alpha: 1, warp: 0.14 }, ms: 900, ease: easeOut }] },
  // Вхід не вдався: хрест повертається у фон. Лише після emerge (див. play): інакше нічого не робить.
  rest: { steps: [{ to: AT_LOGIN, ms: 600, ease: easeOut }] },
  // Вхід удався: хрест летить на глядача, розсіюється, і на тлі застосунку лишається ледь помітний слід.
  enter: {
    steps: [
      { to: COVER, ms: 650, ease: easeIn, front: true },
      { to: { alpha: 0 }, ms: 450, ease: easeOut },
      { to: { scale: AMBIENT.scale, warp: AMBIENT.warp }, ms: 0, front: false },
      { to: { alpha: AMBIENT.alpha }, ms: 800, ease: easeOut },
    ],
  },
  // Sign out: хрест збирається з диму над сторінкою, тоді мчить на глядача й перекриває екран. Доводимо до кінця, навіть
  // якщо сторінка входу вже відкрилась: інакше хрест зник би на півдорозі.
  summon: {
    finish: true,
    steps: [
      { to: { scale: 0.55, alpha: 0, warp: 2.2 }, ms: 0, front: true },
      { to: { scale: 1.2, alpha: 1, warp: 0.25 }, ms: 900, ease: easeOut },
      { to: COVER, ms: 550, ease: easeIn },
    ],
  },
  // Сторінка входу після виходу: хрест відступає з-перед екрана у фон.
  arrive: {
    steps: [
      { to: { scale: 2.5 }, ms: 600, ease: easeOut },
      { to: AT_LOGIN, ms: 900, ease: easeOut, front: false },
    ],
  },
};

/** Анімація під час переходу між сторінками: лише вхід у застосунок і повернення на сторінку входу. */
export function cueForNavigation(from: string, to: string): Cue | null {
  if (from === to) return null;
  if (to === "/login") return "arrive";
  if (from === "/login") return "enter";
  return null;
}

export const restingState = (pathname: string): SmokeState => (pathname === "/login" ? AT_LOGIN : AMBIENT);

export class SmokeTimeline {
  private keyframes: Keyframe[];
  // До цього моменту поточну анімацію не перериваємо: новий cue чекає її кінця.
  private finishAt = -Infinity;
  private last: Cue | null = null;

  constructor(initial: SmokeState) {
    this.keyframes = [{ at: -Infinity, state: initial, ease: linear }];
  }

  /** Одразу перейти в стан без анімації (prefers-reduced-motion). */
  jump(state: SmokeState) {
    this.keyframes = [{ at: -Infinity, state, ease: linear }];
    this.finishAt = -Infinity;
    this.last = null;
  }

  /** Момент, після якого стан не змінюється: далі досить одного нерухомого кадру. */
  get endsAt(): number {
    return this.keyframes[this.keyframes.length - 1].at;
  }

  /**
   * Анімацію перервала помилка (вхід чи вихід не вдався, сторінка помилки): одразу під вміст, щоб повідомлення було
   * видно, і плавно в стан сторінки. Не чекає незавершеної анімації.
   */
  settle(state: SmokeState, now: number) {
    const current = { ...this.sample(now), front: false };
    this.keyframes = [
      { at: now, state: current, ease: linear },
      { at: now + 600, state, ease: easeOut },
    ];
    this.finishAt = -Infinity;
    this.last = null;
  }

  play(cue: Cue, now: number) {
    // Кнопка входу шле rest і під час монтування (після невдалого входу сторінку буває змонтовано заново): повертати у
    // фон є що лише після emerge — не після виходу (arrive) і не на першому відкритті.
    if (cue === "rest" && this.last !== "emerge") return;
    // Подвійний клік на Sign out: хрест уже летить.
    if (cue === "summon" && this.last === "summon") return;
    this.last = cue;
    const { steps, finish } = CUES[cue];
    const start = Math.max(now, this.finishAt);
    let state = this.sample(start);
    // Чекаємо кінця попередньої анімації — її кадри лишаються; інакше нова починається з поточного стану.
    this.keyframes = start > now ? this.keyframes.filter((k) => k.at <= start) : [{ at: start, state, ease: linear }];
    let at = start;
    for (const step of steps) {
      at += step.ms;
      state = { ...state, ...step.to, front: step.front ?? state.front };
      this.keyframes.push({ at, state, ease: step.ease ?? linear });
    }
    this.finishAt = finish ? at : start;
  }

  sample(now: number): SmokeState {
    const k = this.keyframes;
    let i = k.length - 1;
    while (i > 0 && k[i].at > now) i--;
    if (i === k.length - 1) return k[i].state;
    const a = k[i];
    const b = k[i + 1];
    const e = b.ease((now - a.at) / (b.at - a.at));
    const mix = (key: keyof Numbers) => a.state[key] + (b.state[key] - a.state[key]) * e;
    return { scale: mix("scale"), alpha: mix("alpha"), warp: mix("warp"), front: b.state.front };
  }
}
