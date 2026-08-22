/**
 * Pure geometry helpers for the problem stage, ported from
 * legacy/problems.html. No three.js and no DOM here, so both the 3D scene and
 * the flat React boards can share them.
 */

export type Pt = readonly [number, number, number];
export type Points = Record<string, Pt>;

export const dist = (P: Points, a: string, b: string) =>
  Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1], P[a][2] - P[b][2]);

/**
 * Lengths the way the original printed them: whole numbers bare, exact
 * surds as √n, everything else to 2dp. Answers like √38 stay exact rather
 * than turning into 6.16.
 */
export function nice(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  const sq = v * v;
  if (Math.abs(sq - Math.round(sq)) < 1e-7) return "√" + Math.round(sq);
  return v.toFixed(2);
}

/** A₁ rather than A1, matching the figure and the problem statements. */
export const nm = (k: string) =>
  k.replace(/1/g, "₁").replace(/2/g, "₂").replace(/3/g, "₃");

export const keyOf = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/* ============================================================
   flat true-shape board
   ============================================================ */

export type TriShape = {
  poly: string;
  verts: { x: number; y: number; lx: number; ly: number; label: string }[];
  edges: { x1: number; y1: number; x2: number; y2: number; lx: number; ly: number; label: string | null }[];
  rightAngles: string[];
  width: number;
  height: number;
};

const W = 320, H = 180, PAD = 40;

/**
 * Unfolds one triangle of the 3D figure into its true shape on the page —
 * the move the whole stage is teaching. Side lengths come from the real
 * points, so the flat drawing is congruent to the space triangle.
 *
 * `givenOnly` labels a side only when the statement stated it; that is the
 * student's own scratchpad, which should not hand them lengths they have
 * not worked out yet.
 */
export function triShape(
  P: Points,
  keys: [string, string, string],
  opts: { givenOnly?: boolean; known?: readonly (readonly [string, string])[] } = {},
): TriShape {
  const [a, b, c] = keys;
  const L1 = dist(P, a, b), L2 = dist(P, b, c), L3 = dist(P, c, a);

  // Place AB on the x-axis, then locate C from the two remaining sides.
  const x3 = (L1 * L1 + L3 * L3 - L2 * L2) / (2 * L1);
  const y3 = Math.sqrt(Math.max(0, L3 * L3 - x3 * x3));
  const raw: [number, number][] = [[0, 0], [L1, 0], [x3, y3]];

  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1]);
  const mnx = Math.min(...xs), mxx = Math.max(...xs);
  const mny = Math.min(...ys), mxy = Math.max(...ys);
  const sc = Math.min((W - 2 * PAD) / (mxx - mnx || 1), (H - 2 * PAD) / (mxy - mny || 1));
  const ox = (W - (mxx - mnx) * sc) / 2 - mnx * sc;
  const oy = (H - (mxy - mny) * sc) / 2 - mny * sc;
  const q = raw.map((p) => [ox + p[0] * sc, H - (oy + p[1] * sc)] as [number, number]);
  const cen = [
    (q[0][0] + q[1][0] + q[2][0]) / 3,
    (q[0][1] + q[1][1] + q[2][1]) / 3,
  ];

  const givenLabel = (x: string, y: string) => {
    const g = opts.known ?? [];
    const stated = g.some(
      (e) => (e[0] === x && e[1] === y) || (e[0] === y && e[1] === x),
    );
    return stated ? nice(dist(P, x, y)) : null;
  };

  const edgePairs: [number, number, string, string][] = [
    [0, 1, a, b], [1, 2, b, c], [2, 0, c, a],
  ];
  const edges = edgePairs.map(([i, j, ka, kb]) => {
    const mx = (q[i][0] + q[j][0]) / 2, my = (q[i][1] + q[j][1]) / 2;
    const dx = mx - cen[0], dy = my - cen[1], dl = Math.hypot(dx, dy) || 1;
    return {
      x1: q[i][0], y1: q[i][1], x2: q[j][0], y2: q[j][1],
      lx: mx + (dx / dl) * 15, ly: my + (dy / dl) * 15 + 4,
      label: opts.givenOnly ? givenLabel(ka, kb) : nice(dist(P, ka, kb)),
    };
  });

  // A square marker wherever two sides meet at 90°.
  const rightAngles: string[] = [];
  for (let i = 0; i < 3; i++) {
    const A = q[i], B = q[(i + 1) % 3], C = q[(i + 2) % 3];
    const u = [B[0] - A[0], B[1] - A[1]], v = [C[0] - A[0], C[1] - A[1]];
    const cs =
      (u[0] * v[0] + u[1] * v[1]) /
      (Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1]));
    if (Math.abs(cs) < 1e-6) {
      const s = 13;
      const un = [(u[0] / Math.hypot(u[0], u[1])) * s, (u[1] / Math.hypot(u[0], u[1])) * s];
      const vn = [(v[0] / Math.hypot(v[0], v[1])) * s, (v[1] / Math.hypot(v[0], v[1])) * s];
      rightAngles.push(
        `M${(A[0] + un[0]).toFixed(1)},${(A[1] + un[1]).toFixed(1)}` +
          ` L${(A[0] + un[0] + vn[0]).toFixed(1)},${(A[1] + un[1] + vn[1]).toFixed(1)}` +
          ` L${(A[0] + vn[0]).toFixed(1)},${(A[1] + vn[1]).toFixed(1)}`,
      );
    }
  }

  const verts = q.map((p, i) => {
    const dx = p[0] - cen[0], dy = p[1] - cen[1], dl = Math.hypot(dx, dy) || 1;
    return {
      x: p[0], y: p[1],
      lx: p[0] + (dx / dl) * 17, ly: p[1] + (dy / dl) * 17 + 4.5,
      label: nm(keys[i]),
    };
  });

  return {
    poly: q.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "),
    verts, edges, rightAngles, width: W, height: H,
  };
}

/* ============================================================
   deterministic shuffle
   ============================================================ */

/**
 * Stable per problem, so the right answer is not always listed first but
 * also does not jump around as the component re-renders.
 */
export function shuffled<T>(arr: readonly T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const out = arr.slice();
  for (let j = out.length - 1; j > 0; j--) {
    const k = Math.floor(rnd() * (j + 1));
    [out[j], out[k]] = [out[k], out[j]];
  }
  return out;
}
