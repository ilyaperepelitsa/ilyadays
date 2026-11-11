/**
 * The double-tap shield of the gym screen (stream 04). Some taps move the screen under the thumb: logging a set (the
 * next row opens, the rest timer appears, the view scrolls), Start (the session and its End button replace the start
 * panel), Swap and End (a sheet slides up with buttons where the thumb is). The second tap of a double tap would land
 * on whatever arrived there, so for SHIELD_MS after such a tap a tap on the same spot is dropped.
 *
 * One shield per tab (module state): the start panel arms it and the session that replaces it honours it. Put
 * `onClickCapture` on the root of each screen (React's capture phase also sees taps inside its sheets), and call
 * `arm()` in the handlers that move the screen.
 */
import { useSyncExternalStore, type MouseEvent } from "react";

/**
 * How long a tap on the same spot is dropped (the rehearsal's probe: 7 of 18 double taps 80–300 ms apart logged two
 * sets).
 */
export const SHIELD_MS = 700;
/** "The same spot": a thumb's second tap lands within this many px of the first. */
const SHIELD_PX = 48;
/** The next set's Done waits a little longer than the shield, so the tap that finds it enabled is never dropped. */
const HOLD_MS = SHIELD_MS + 60;

let lastTap: { x: number; y: number } | null = null;
let shield: { t: number; x: number; y: number } | null = null;
let holding: number | null = null;
const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};
const isHolding = () => holding != null;
const notHolding = () => false;

/** Capture phase of every tap on the screen: drop the second tap of a double tap, remember where this one landed. */
function onClickCapture(e: MouseEvent) {
  const s = shield;
  if (s && e.detail > 0 && performance.now() - s.t < SHIELD_MS && Math.hypot(e.clientX - s.x, e.clientY - s.y) < SHIELD_PX) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  // keyboard and assistive activation (detail 0) has no spot: it never arms a shield around a stale one
  lastTap = e.detail > 0 ? { x: e.clientX, y: e.clientY } : null;
}

/**
 * Shield the spot of the tap being handled. `holdDone`: also report `holding` for a moment, so the next set's Done
 * (which slides under the thumb) stays disabled until the shield is over.
 */
function arm(holdDone = false) {
  const t = performance.now();
  shield = { t, x: lastTap?.x ?? Number.NaN, y: lastTap?.y ?? Number.NaN };
  if (!holdDone) return;
  holding = t;
  for (const listener of listeners) listener();
  window.setTimeout(() => {
    if (holding !== t) return;
    holding = null;
    for (const listener of listeners) listener();
  }, HOLD_MS);
}

export function useTapShield(): { onClickCapture: (e: MouseEvent) => void; arm: (holdDone?: boolean) => void; holding: boolean } {
  return { onClickCapture, arm, holding: useSyncExternalStore(subscribe, isHolding, notHolding) };
}
