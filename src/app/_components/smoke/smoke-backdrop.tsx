"use client";

import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createSmokeRenderer, cssColorToRgb } from "./renderer";
import { type Cue, cueForNavigation, restingState, SmokeTimeline } from "./timeline";

// settle — анімацію перервала помилка: хрест іде під вміст і в стан поточної сторінки.
type PageCue = Extract<Cue, "emerge" | "rest" | "summon"> | "settle";

// Без SmokeBackdrop (тести сторінок, Storybook) кнопки входу й виходу просто нічого не анімують.
const SmokeCue = createContext<(cue: PageCue) => void>(() => {});
export const useSmokeCue = () => useContext(SmokeCue);

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const reducedMotion = () => matchMedia(REDUCED_MOTION).matches;

// Канва в кореневому layout: між сторінками вона не перемонтовується, тож анімація входу й виходу триває через перехід.
export function SmokeBackdrop({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [timeline] = useState(() => new SmokeTimeline(restingState(pathname)));
  const canvas = useRef<HTMLCanvasElement>(null);
  const path = useRef(pathname);
  const restart = useRef(() => {});

  useEffect(() => {
    const el = canvas.current!;
    const renderer = createSmokeRenderer(el);
    if (!renderer) return;
    const reduced = matchMedia(REDUCED_MOTION);
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    let frame = 0;
    let lost = false;

    // Дим рухається лише на сторінці входу й поки триває анімація. На робочих сторінках — нерухомий кадр: вимога PM
    // «інтерфейс не має відволікати», і GPU не малює весь день те саме тло. Без руху (prefers-reduced-motion) — теж
    // один кадр стану сторінки.
    const loop = (now: number) => {
      const state = timeline.sample(now);
      el.dataset.front = String(state.front);
      renderer.draw(state, reduced.matches ? 0 : now / 1000);
      const moving = !reduced.matches && (path.current === "/login" || now < timeline.endsAt);
      frame = moving ? requestAnimationFrame(loop) : 0;
    };
    const start = () => {
      cancelAnimationFrame(frame);
      if (lost) return;
      if (reduced.matches) timeline.jump(restingState(path.current));
      frame = requestAnimationFrame(loop);
    };
    // Після втрати контексту (сон, скидання GPU) малювати нічим: тло зникає до перезавантаження сторінки.
    const onLost = () => {
      lost = true;
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
      if (reducedMotion()) return;
      if (next === "settle") timeline.settle(restingState(path.current), performance.now());
      else timeline.play(next, performance.now());
      restart.current();
    },
    [timeline],
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
