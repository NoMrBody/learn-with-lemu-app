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

/* ============================================================
   where a step is best looked at from
   ============================================================ */

/** Where the camera stands, in the spherical degrees lib/problems/scene.ts orbits in. */
export type View = { theta: number; phi: number };

/**
 * The points a step is actually about: the triangle it pulls out flat, the
 * ends of the segments it draws, and the pairs whose lengths it wins.
 *
 * Deliberately a superset of `board`. A step that draws a line without naming
 * a triangle — the four sides of a section — still has a plane, and it is the
 * one those segments lie in.
 */
export function stepFocus(step: {
  board?: readonly [string, string, string] | null;
  add?: readonly (readonly [string, string, string])[];
  lens?: readonly (readonly [string, string])[];
}): string[] {
  const out: string[] = [];
  const put = (k: string) => { if (!out.includes(k)) out.push(k); };
  (step.board ?? []).forEach(put);
  (step.add ?? []).forEach((e) => { put(e[0]); put(e[1]); });
  (step.lens ?? []).forEach((e) => { put(e[0]); put(e[1]); });
  return out;
}

type V3 = [number, number, number];
const sub = (a: Pt, b: Pt): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** The unit direction the camera stands in for a `View`. */
export function dirOf(v: View): V3 {
  const t = (v.theta * Math.PI) / 180, p = (v.phi * Math.PI) / 180;
  return [Math.cos(p) * Math.cos(t), Math.cos(p) * Math.sin(t), Math.sin(p)];
}

/** The `View` a unit direction stands at. φ is clamped short of the pole, where
 *  a z-up camera's `lookAt` has no way to decide which way round it is. */
function viewAt(d: V3): View {
  return {
    theta: (Math.atan2(d[1], d[0]) * 180) / Math.PI,
    phi: Math.max(-72, Math.min(72, (Math.asin(Math.max(-1, Math.min(1, d[2]))) * 180) / Math.PI)),
  };
}

/** Rotate `from` toward `to` by at most `deg`, both unit vectors. */
function toward(from: V3, to: V3, deg: number): V3 {
  const c = Math.max(-1, Math.min(1, dot(from, to)));
  const ang = Math.acos(c);
  const want = (deg * Math.PI) / 180;
  if (ang <= want || ang < 1e-6 || Math.PI - ang < 1e-6) return from;
  const t = want / ang;
  const s = Math.sin(ang);
  const a = Math.sin((1 - t) * ang) / s, b = Math.sin(t * ang) / s;
  return norm([
    from[0] * a + to[0] * b,
    from[1] * a + to[1] * b,
    from[2] * a + to[2] * b,
  ]);
}

/**
 * Looking straight down a plane's normal shows the step's triangle at its true
 * shape — and flattens the solid around it into a wireframe with no depth at
 * all. So the camera stops this far short of face-on: enough to read the
 * triangle, enough to still see it sitting inside a box.
 */
const TILT = 22;

/**
 * Where to look at `focus` from — the plane those points work in, seen close to
 * face-on. `home` is the problem's own viewpoint: it settles the two things the
 * geometry cannot, namely which side of the plane to stand on when both are
 * equally clear, and which way to look along a bare segment.
 *
 * `null` when the step names no geometry of its own (a step that only
 * multiplies two lengths it already has). The caller holds its current aim
 * rather than inventing one — a step that draws nothing has nothing to show.
 */
export function viewOf(P: Points, focus: readonly string[], home: View): View | null {
  const ks = focus.filter((k) => P[k]);
  if (ks.length < 2) return null;
  const h = dirOf(home);

  const cen = (list: readonly string[]): V3 => {
    const c: V3 = [0, 0, 0];
    list.forEach((k) => { c[0] += P[k][0]; c[1] += P[k][1]; c[2] += P[k][2]; });
    return [c[0] / list.length, c[1] / list.length, c[2] / list.length];
  };
  const fc = cen(ks);
  let spread = 0;
  for (const k of ks) spread = Math.max(spread, len(sub(P[k], fc)));
  if (spread < 1e-9) return null;

  // The plane the step works in is the one its biggest triangle spans. The sets
  // here are a handful of points, so trying every triple is both exact and free.
  let n: V3 | null = null, best = 0;
  for (let i = 0; i < ks.length; i++) {
    for (let j = i + 1; j < ks.length; j++) {
      for (let m = j + 1; m < ks.length; m++) {
        const c = cross(sub(P[ks[j]], P[ks[i]]), sub(P[ks[m]], P[ks[i]]));
        const l = len(c);
        if (l > best) { best = l; n = c; }
      }
    }
  }

  let v: V3;
  if (n && best > 1e-3 * spread * spread) {
    v = norm(n);
  } else {
    // Two points, or three in a line: there is no plane, only an axis. Stand at
    // right angles to it — that is where the segment reads at its full length —
    // and among all those directions take the one nearest home.
    let axis: V3 = [0, 0, 1], al = 0;
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const d = sub(P[ks[j]], P[ks[i]]);
        if (len(d) > al) { al = len(d); axis = d; }
      }
    }
    const a = norm(axis);
    const k = dot(h, a);
    const perp: V3 = [h[0] - k * a[0], h[1] - k * a[1], h[2] - k * a[2]];
    // Home looking straight down the segment leaves nothing to project; any
    // perpendicular will do, so take one.
    v = len(perp) > 1e-6 ? norm(perp) : norm(cross(a, Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  }

  // Both sides of a plane show it equally well, and only one of them is any use:
  // the problem's own viewpoint is above the figure and outside it, so stay in
  // that half of the sky. Standing on the far side of the base plane would show
  // the floor at a perfect true shape, from underneath the ground.
  const near = dot(v, h);
  // Unless the plane runs edge-on to home, where neither side is nearer and the
  // sign would be decided by rounding. Then take the side the focus faces, which
  // is at least the side with less of the solid in the way.
  const wc = cen(Object.keys(P));
  const side = Math.abs(near) > 0.05 ? near : dot(v, sub(fc, wc) as V3);
  if (side < 0) v = [-v[0], -v[1], -v[2]];

  return viewAt(toward(v, h, TILT));
}
