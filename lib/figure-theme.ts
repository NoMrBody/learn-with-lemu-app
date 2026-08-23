/**
 * Theme colours for the Three.js figures.
 *
 * The scenes render onto a transparent canvas over a CSS-painted ground, so
 * the ground follows the theme for free — but everything drawn *in* WebGL is
 * a number, and a number cannot cascade. This is the bridge: it reads the
 * --fig-* custom properties off <html> and hands back integers Three.js can
 * use, then tells the scenes when those values have changed.
 *
 * Only structural colours live here. The semantic ones — red target, blue
 * known, amber built, the face-kind hues — stay literal in the scene files,
 * because they carry meaning that must not drift with the theme.
 */

/** Structural roles a figure draws with. Names match the CSS tokens. */
export type FigureRole = "ink" | "dim" | "wire" | "rule";

const FALLBACK: Record<FigureRole, number> = {
  ink: 0x14181a,
  dim: 0x5a6560,
  wire: 0x93a09a,
  rule: 0xdce3e0,
};

let cache: Partial<Record<FigureRole, number>> = {};

/**
 * Parse whatever the browser hands back for a custom property. Computed
 * values come back as `rgb(r g b)` or `rgb(r, g, b)` in every current engine,
 * but a hex literal is still possible if the property is read before the
 * cascade has resolved it, so both are handled.
 */
function parse(value: string): number | null {
  const v = value.trim();
  if (!v) return null;

  if (v.startsWith("#")) {
    const h = v.slice(1);
    if (h.length === 3) {
      return parseInt(h[0] + h[0] + h[1] + h[1] + h[2] + h[2], 16);
    }
    if (h.length >= 6) return parseInt(h.slice(0, 6), 16);
    return null;
  }

  const nums = v.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return null;
  const [r, g, b] = nums.slice(0, 3).map((n) => Math.round(Number(n)));
  return (r << 16) | (g << 8) | b;
}

/** The current value of one structural colour, as a Three.js hex int. */
export function figColor(role: FigureRole): number {
  const hit = cache[role];
  if (hit !== undefined) return hit;
  if (typeof window === "undefined") return FALLBACK[role];

  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    `--fig-${role}`,
  );
  const parsed = parse(raw);
  const value = parsed ?? FALLBACK[role];
  cache[role] = value;
  return value;
}

/**
 * Run `cb` whenever the resolved theme changes — either because next-themes
 * rewrote the class on <html>, or because the OS flipped while the reader is
 * on "system". The cache is cleared before `cb` runs, so figColor() inside it
 * already returns the new values.
 *
 * Returns an unsubscribe. Safe to call during SSR, where it is a no-op.
 */
export function onFigureTheme(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const fire = () => {
    cache = {};
    cb();
  };

  const observer = new MutationObserver(fire);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", fire);

  return () => {
    observer.disconnect();
    mq.removeEventListener("change", fire);
  };
}
