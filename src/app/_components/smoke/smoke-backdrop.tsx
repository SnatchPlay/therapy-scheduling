"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createSmokeRenderer, cssColorToRgb } from "./renderer";
import { type Cue, cueForNavigation, restingState, SmokeTimeline } from "./timeline";

// settle — анімацію перервала помилка: хрест іде під вміст і в стан поточної сторінки.
type PageCue = Extract<Cue, "emerge" | "rest" | "summon"> | "settle";

type Smoke = {
  cue: (cue: PageCue) => void;
  /**
   * Сесію вже закрито: відкрити /login, щойно хрест перекриє екран (проміс — коли перехід запущено), і викликати
   * onArrive, коли /login уже поточна сторінка. Чекати сам перехід у form action не можна: навігація не завершиться,
   * поки триває дія.
   */
  leave: (onArrive: () => Promise<void>) => Promise<void>;
};

// Без SmokeBackdrop (тести сторінок, Storybook) кнопки входу й виходу нічого не анімують і нікуди не переходять.
const SmokeContext = createContext<Smoke>({ cue: () => {}, leave: async () => {} });
export const useSmoke = () => useContext(SmokeContext);

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const AMBIENT_FPS = 30;
const reducedMotion = () => matchMedia(REDUCED_MOTION).matches;
// Очищення після виходу не вдалося (мережа): повне перезавантаження /login теж скидає все, що вкладка пам'ятає.
const arriveSafely = (onArrive: () => Promise<void>) => onArrive().catch(() => location.replace("/login"));

// Канва в кореневому layout: між сторінками вона не перемонтовується, тож анімація входу й виходу триває через перехід.
export function SmokeBackdrop({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [timeline] = useState(() => new SmokeTimeline(restingState(pathname)));
  const canvas = useRef<HTMLCanvasElement>(null);
  const router = useRouter();
  const path = useRef(pathname);
  const restart = useRef(() => {});
  // Чи справді малюємо: без WebGL чи після втрати контексту анімації не видно — і чекати її нема чого.
  const drawing = useRef(false);
  // onArrive з leave(): що зробити, коли /login стане поточною сторінкою.
  const arrived = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const el = canvas.current!;
    const renderer = createSmokeRenderer(el);
    if (!renderer) return;
    drawing.current = true;
    const reduced = matchMedia(REDUCED_MOTION);
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    let frame = 0;
    let lost = false;
    let drawnAt = -Infinity;

    // Дим рухається завжди. Поки йде анімація входу чи виходу — кожен кадр екрана; у спокої тло повільне, тож досить
    // AMBIENT_FPS: GPU не малює 60–120 кадрів на секунду весь робочий день. Без руху (prefers-reduced-motion) — один
    // нерухомий кадр стану сторінки й жодного циклу.
    const loop = (now: number) => {
      // Допуск 2 мс: кадри екрана приходять із заокругленим часом, і точне «≥ 33.3 мс» пропускало б кожен другий кадр.
      if (now < timeline.endsAt || now - drawnAt >= 1000 / AMBIENT_FPS - 2) {
        const state = timeline.sample(now);
        el.dataset.front = String(state.front);
        renderer.draw(state, reduced.matches ? 0 : now / 1000);
        drawnAt = now;
      }
      frame = reduced.matches ? 0 : requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(frame);
      drawnAt = -Infinity;
      if (lost) return;
      if (reduced.matches) timeline.jump(restingState(path.current));
      frame = requestAnimationFrame(loop);
    };
    // Після втрати контексту (сон, скидання GPU) малювати нічим: тло зникає до перезавантаження сторінки.
    const onLost = () => {
      lost = true;
      drawing.current = false;
      cancelAnimationFrame(frame);
    };
    const recolor = () => {
      renderer.setColor(cssColorToRgb(getComputedStyle(el).getPropertyValue("--primary")));
      start();
    };

    restart.current = start;
    recolor();
    reduced.addEventListener("change", start);
    scheme.addEventListener("change", recolor);
    addEventListener("resize", start);
    el.addEventListener("webglcontextlost", onLost);
    return () => {
      cancelAnimationFrame(frame);
      reduced.removeEventListener("change", start);
      scheme.removeEventListener("change", recolor);
      removeEventListener("resize", start);
      el.removeEventListener("webglcontextlost", onLost);
      restart.current = () => {};
      drawing.current = false;
      renderer.dispose();
    };
  }, [timeline]);

  useEffect(() => {
    const cue = cueForNavigation(path.current, pathname);
    path.current = pathname;
    if (cue && !reducedMotion()) timeline.play(cue, performance.now());
    restart.current();
    if (pathname === "/login" && arrived.current) {
      void arriveSafely(arrived.current);
      arrived.current = null;
    }
  }, [pathname, timeline]);

  const cue = useCallback(
    (next: PageCue) => {
      if (reducedMotion()) return;
      const now = performance.now();
      if (next === "settle") timeline.settle(restingState(path.current), now);
      else timeline.play(next, now);
      restart.current();
    },
    [timeline],
  );

  const leave = useCallback(
    (onArrive: () => Promise<void>) =>
      new Promise<void>((resolve) => {
        const covered = drawing.current && !reducedMotion() ? Math.max(0, timeline.endsAt - performance.now()) : 0;
        setTimeout(() => {
          // Вихід зі сторінки помилки на /login: шлях не зміниться — одразу onArrive.
          if (path.current === "/login") {
            void arriveSafely(onArrive);
          } else {
            arrived.current = onArrive;
            router.replace("/login");
          }
          resolve();
        }, covered);
      }),
    [timeline, router],
  );

  const smoke = useMemo(() => ({ cue, leave }), [cue, leave]);

  return (
    <SmokeContext value={smoke}>
      <canvas
        ref={canvas}
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 size-full data-[front=true]:z-50"
      />
      {children}
    </SmokeContext>
  );
}
