"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createSmokeRenderer, cssColorToRgb } from "./renderer";
import { type Cue, cueForNavigation, restingState, SmokeTimeline } from "./timeline";

// settle — анімацію перервала помилка: хрест іде під вміст і в стан поточної сторінки.
// leave — сесію вже закрито: відкрити сторінку входу, щойно хрест перекриє екран (кінець summon).
type PageCue = Extract<Cue, "emerge" | "rest" | "summon"> | "settle" | "leave";

// Без SmokeBackdrop (тести сторінок, Storybook) кнопки входу й виходу нічого не анімують і нікуди не переходять.
const SmokeCue = createContext<(cue: PageCue) => void>(() => {});
export const useSmokeCue = () => useContext(SmokeCue);

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const AMBIENT_FPS = 30;
const reducedMotion = () => matchMedia(REDUCED_MOTION).matches;

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
  }, [pathname, timeline]);

  const cue = useCallback(
    (next: PageCue) => {
      const now = performance.now();
      if (next === "leave") {
        const covered = drawing.current && !reducedMotion() ? Math.max(0, timeline.endsAt - now) : 0;
        setTimeout(() => router.replace("/login"), covered);
        return;
      }
      if (reducedMotion()) return;
      if (next === "settle") timeline.settle(restingState(path.current), now);
      else timeline.play(next, now);
      restart.current();
    },
    [timeline, router],
  );

  return (
    <SmokeCue value={cue}>
      <canvas
        ref={canvas}
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 size-full data-[front=true]:z-50"
      />
      {children}
    </SmokeCue>
  );
}
