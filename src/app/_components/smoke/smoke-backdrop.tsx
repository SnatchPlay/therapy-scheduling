"use client";

import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createSmokeRenderer, cssColorToRgb } from "./renderer";
import { type Cue, cueForNavigation, restingState, SmokeTimeline } from "./timeline";

type ButtonCue = Extract<Cue, "emerge" | "rest" | "summon">;

// Без SmokeBackdrop (тести сторінок, Storybook) кнопки входу й виходу просто нічого не анімують.
const SmokeCue = createContext<(cue: ButtonCue) => void>(() => {});
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

    const draw = (now: number) => {
      const state = timeline.sample(now);
      el.dataset.front = String(state.front);
      renderer.draw(state, reduced.matches ? 0 : now / 1000);
    };
    const loop = (now: number) => {
      draw(now);
      frame = requestAnimationFrame(loop);
    };
    // Без руху: один нерухомий кадр стану поточної сторінки, без циклу.
    const start = () => {
      cancelAnimationFrame(frame);
      if (reduced.matches) {
        timeline.jump(restingState(path.current));
        draw(performance.now());
      } else {
        frame = requestAnimationFrame(loop);
      }
    };
    const recolor = () => {
      renderer.setColor(cssColorToRgb(getComputedStyle(el).getPropertyValue("--primary")));
      start();
    };

    restart.current = start;
    recolor();
    reduced.addEventListener("change", start);
    scheme.addEventListener("change", recolor);
    return () => {
      cancelAnimationFrame(frame);
      reduced.removeEventListener("change", start);
      scheme.removeEventListener("change", recolor);
      restart.current = () => {};
      renderer.dispose();
    };
  }, [timeline]);

  useEffect(() => {
    const cue = cueForNavigation(path.current, pathname);
    path.current = pathname;
    if (reducedMotion()) restart.current();
    else if (cue) timeline.play(cue, performance.now());
  }, [pathname, timeline]);

  const cue = useCallback(
    (next: ButtonCue) => {
      if (!reducedMotion()) timeline.play(next, performance.now());
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
