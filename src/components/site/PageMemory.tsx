"use client";
// Remembered per page in localStorage (never cookies): the scroll position and, on recipe pages, the ticked
// ingredients and steps. Restored on reload and back/forward, and when the page is reopened within a cooking
// session (12 h) — e.g. the phone dropped the tab while you were cooking. Ported from recipes/static/app.js.
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SESSION_MS = 12 * 60 * 60 * 1000;
const TICKABLE = ".ingredients li, li.step";

type Saved = { y?: number; done?: number[]; t?: number };

export function PageMemory() {
  const pathname = usePathname();

  useEffect(() => {
    const key = `page:${pathname}`;
    const load = (): Saved => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? "{}") || {};
      } catch {
        return {};
      }
    };
    const save = (patch: Saved) => {
      try {
        localStorage.setItem(key, JSON.stringify({ ...load(), ...patch, t: Date.now() }));
      } catch {
        /* storage blocked */
      }
    };
    const tickable = () => [...document.querySelectorAll<HTMLElement>(TICKABLE)];
    const navType = (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type;
    const saved = load();
    const resume = navType === "reload" || navType === "back_forward" || (!!saved.t && Date.now() - saved.t < SESSION_MS);

    if (resume && Array.isArray(saved.done)) {
      const items = tickable();
      saved.done.forEach((i) => items[i]?.classList.add("done"));
    }

    const cleanups: (() => void)[] = [];
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (resume && (saved.y ?? 0) > 0 && !location.hash) {
      // Pictures load lazily, so re-apply until the page settles or the reader scrolls themselves.
      let userMoved = false;
      const go = () => {
        if (!userMoved) window.scrollTo(0, saved.y!);
      };
      const stop = () => {
        userMoved = true;
      };
      (["wheel", "touchstart", "keydown"] as const).forEach((ev) => {
        window.addEventListener(ev, stop, { once: true, passive: true });
        cleanups.push(() => window.removeEventListener(ev, stop));
      });
      go();
      const raf = requestAnimationFrame(go);
      const timer = setTimeout(go, 600);
      if (document.readyState !== "complete") {
        window.addEventListener("load", go, { once: true });
        cleanups.push(() => window.removeEventListener("load", go));
      }
      cleanups.push(() => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      });
    }

    let pending: ReturnType<typeof setTimeout> | 0 = 0;
    const onScroll = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = 0;
        save({ y: Math.round(window.scrollY) });
      }, 250);
    };
    const onHide = () => save({ y: Math.round(window.scrollY) });

    // Tap ingredients and steps to tick them off while cooking.
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target || target.closest("a, input, label, summary, table, button")) return;
      const li = target.closest(TICKABLE);
      if (!li) return;
      li.classList.toggle("done");
      save({ done: tickable().flatMap((el, i) => (el.classList.contains("done") ? [i] : [])) });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onHide);
    document.addEventListener("click", onClick);
    return () => {
      onHide();
      if (pending) clearTimeout(pending);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("click", onClick);
      cleanups.forEach((f) => f());
    };
  }, [pathname]);

  return null;
}
