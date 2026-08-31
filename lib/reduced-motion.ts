/**
 * Whether the reader has asked for less motion.
 *
 * app/globals.css already answers this for everything CSS drives. The figures
 * are not CSS: they are Three.js scenes stepping their own RAF loop, and a
 * media query in a stylesheet cannot reach a `mesh.scale.set()`. So they have
 * to ask.
 *
 * Shaped like lib/figure-theme.ts — read the current value, subscribe to
 * changes so flipping the OS setting mid-lesson takes effect, and answer
 * `false` on the server, where there is no media to match.
 */

const REDUCED = "(prefers-reduced-motion: reduce)";

/** The reader's current preference. Safe during SSR. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(REDUCED).matches;
}

/**
 * Run `cb` whenever the preference flips. Returns an unsubscribe. Safe to call
 * during SSR, where it is a no-op.
 */
export function onReducedMotion(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** `scrollTo`/`scrollIntoView` honour this, but only if you pass it. */
export const scrollBehavior = (): ScrollBehavior =>
  prefersReducedMotion() ? "auto" : "smooth";
