import type { Level } from "./levels";

/**
 * Isometric wireframe for a level card, ported from thumbSVG in
 * legacy/game.html. Returns shape data; the React component draws it.
 */

export type Thumb = {
  width: number;
  height: number;
  wire: { x1: number; y1: number; x2: number; y2: number }[];
  target: { x1: number; y1: number; x2: number; y2: number };
  dots: { x: number; y: number }[];
};

const W = 300, H = 210, PAD = 26;

export function thumb(level: Level): Thumb {
  const P = level.pts();
  // A cheap isometric cast — no camera needed for a static card.
  const proj = (p: readonly number[]): [number, number] => [
    (p[0] - p[1]) * 0.86,
    (p[0] + p[1]) * 0.28 - p[2],
  ];

  const q: Record<string, [number, number]> = {};
  const xs: number[] = [], ys: number[] = [];
  for (const k in P) {
    const v = proj(P[k]);
    q[k] = v; xs.push(v[0]); ys.push(v[1]);
  }
  const mnx = Math.min(...xs), mxx = Math.max(...xs);
  const mny = Math.min(...ys), mxy = Math.max(...ys);
  const sc = Math.min((W - 2 * PAD) / (mxx - mnx || 1), (H - 2 * PAD) / (mxy - mny || 1));
  const ox = (W - (mxx - mnx) * sc) / 2 - mnx * sc;
  const oy = (H - (mxy - mny) * sc) / 2 - mny * sc;
  const T = (k: string): [number, number] => [ox + q[k][0] * sc, H - (oy + q[k][1] * sc)];

  const wire = level.wire.map((e) => {
    const a = T(e[0]), b = T(e[1]);
    return { x1: a[0], y1: a[1], x2: b[0], y2: b[1] };
  });
  const t = T(level.target[0]), u = T(level.target[1]);
  const dots = Object.keys(P).map((k) => {
    const p = T(k);
    return { x: p[0], y: p[1] };
  });

  return {
    width: W, height: H, wire,
    target: { x1: t[0], y1: t[1], x2: u[0], y2: u[1] },
    dots,
  };
}
