import type { Dims } from "./scene";

/**
 * The cuboid explainer's three catalogues — the right triangles, the sections
 * and the angles a problem can ask about — ported from FIGDATA.cuboid in
 * legacy/topic-cuboid.html.
 *
 * Deliberately free of any `three` import. The scene consumes the point
 * generators to draw, and the control panel consumes the same entries to
 * render their labels, LaTeX and notes; keeping this module geometry-only is
 * what lets both read one list instead of two that can drift apart.
 *
 * The legacy closures all read a module-global `D`; here every generator takes
 * the dims it needs, so a catalogue entry is a pure function of the figure.
 */

export type Pt = [number, number, number];

/**
 * The eight corners, named the way lib/explainer/scene.ts and the problem set
 * name them: A B C D round the base, A1 B1 C1 D1 directly above.
 *
 * The legacy file addressed these positionally through `baseRing()`
 * (p[0]=A, p[1]=B, p[2]=C, p[3]=D, and `[p[i][0],p[i][1],H]` for the primed
 * corner). Spelling them out here makes the catalogues below readable as
 * geometry rather than as index arithmetic.
 */
export function corners(d: Dims): Record<string, Pt> {
  const x = d.L / 2, y = d.W / 2, h = d.H;
  return {
    A: [-x, -y, 0], B: [x, -y, 0], C: [x, y, 0], D: [-x, y, 0],
    A1: [-x, -y, h], B1: [x, -y, h], C1: [x, y, h], D1: [-x, y, h],
  };
}

export const mid = (u: Pt, v: Pt): Pt => [
  (u[0] + v[0]) / 2, (u[1] + v[1]) / 2, (u[2] + v[2]) / 2,
];

/* ============================================================
   numbers

   The original printed every derived length as a two-decimal
   figure. These render an exact surd instead, so a space diagonal
   reads 4√5 rather than 8.94 — the form an answer is written in.

   Deliberately separate from `nice` in scene.ts rather than a
   change to it: `nice` is shared with the pyramid explainer, and
   this rewrite is scoped to the cuboid.
   ============================================================ */

/** `v` as a√b / n with n ≤ 8, or null when it is not a tidy surd. */
export function surdOf(v: number): { a: number; b: number; n: number } | null {
  if (!Number.isFinite(v)) return null;
  if (Math.abs(v - Math.round(v)) < 1e-9) return { a: Math.round(v), b: 1, n: 1 };

  const sq = v * v;
  for (let n = 1; n <= 8; n++) {
    const t = sq * n * n;
    if (Math.abs(t - Math.round(t)) >= 1e-6) continue;

    let r = Math.round(t), a = 1;
    // Pull the largest square factor out from under the root.
    for (let k = Math.floor(Math.sqrt(r)); k >= 2; k--) {
      if (r % (k * k) === 0) { a = k; r /= k * k; break; }
    }
    const gcd = (p: number, q: number): number => (q ? gcd(q, p % q) : p);
    const g = gcd(a, n);
    return { a: a / g, b: r, n: n / g };
  }
  return null;
}

/** The value as plain text: "3", "2√5", "√3/2", or a decimal. */
export const surd = (v: number): string => {
  const s = surdOf(v);
  if (!s) return v.toFixed(2);
  if (s.b === 1) return s.n === 1 ? String(s.a) : (s.a / s.n).toFixed(2);
  const core = (s.a === 1 ? "" : s.a) + "√" + s.b;
  return s.n === 1 ? core : `${core}/${s.n}`;
};

/** The same value as LaTeX. */
export const texNum = (v: number): string => {
  const s = surdOf(v);
  if (!s) return v.toFixed(2);
  if (s.b === 1) return s.n === 1 ? String(s.a) : `\\tfrac{${s.a}}{${s.n}}`;
  const core = (s.a === 1 ? "" : s.a) + `\\sqrt{${s.b}}`;
  return s.n === 1 ? core : `\\tfrac{${core}}{${s.n}}`;
};

/** Degrees, one decimal — the form the angle chips read in. */
export const deg = (rad: number): string => ((rad * 180) / Math.PI).toFixed(1);

/**
 * A LaTeX rule rewritten for prose, so the "Worth knowing" panel can open with
 * the formula in the same voice as the sentence that follows it.
 */
export function plainRule(t: string): string {
  return String(t)
    .replace(/\\tfrac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
    .replace(/\\sqrt3/g, "√3")
    .replace(/\\sqrt\{([^}]*)\}/g, "√$1")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\quad/g, "  ")
    .replace(/\\times/g, "×")
    .replace(/\^2/g, "²")
    .replace(/\\/g, "");
}

/** The rules the surface-area and volume slides quote. */
export const CUBOID_NET_RULE = "S = 2(lw + lh + wh)";
export const CUBOID_VOL_RULE = "V = lwh";

/* ============================================================
   the catalogues
   ============================================================ */

/** One entry in a chip row: everything the panel and the scene both need. */
type Entry = {
  label: string;
  /** Literal hex. Semantic rather than structural, so it stays out of the theme. */
  col: number;
  tex: (d: Dims) => string;
  note: string;
};

export type FigTri = Entry & {
  /** Which of the three points carries the right-angle mark. */
  right: 0 | 1 | 2;
  pts: (d: Dims) => [Pt, Pt, Pt];
};

export type FigSec = Entry & {
  /** Four points, or three for a cut that comes out a triangle. */
  quad: (d: Dims) => Pt[];
};

export type FigAng = Entry & {
  /** The leaning line, its shadow, and the upright — as [from, to, colour, radius]. */
  lines: (d: Dims) => [Pt, Pt, number, number][];
  /** The degree readout and where to float it. */
  mark: (d: Dims) => [string, Pt];
};

/**
 * Every right triangle the cuboid hides. Each is two sides you know and one you
 * want; what changes is which two you start from.
 */
export const CUBOID_TRIS: FigTri[] = [
  {
    label: "base diagonal",
    col: 0x2b4fe8,
    right: 0,
    tex: (d) => `d_1=\\sqrt{${d.L}^2+${d.W}^2}=${texNum(Math.hypot(d.L, d.W))}`,
    note: "This one lies flat on the bottom face, so it is ordinary flat geometry. Nothing new here.",
    pts: (d) => { const p = corners(d); return [p.B, p.C, p.A]; },
  },
  {
    label: "long-face diagonal",
    col: 0x17a2a0,
    right: 0,
    tex: (d) => `\\sqrt{${d.L}^2+${d.H}^2}=${texNum(Math.hypot(d.L, d.H))}`,
    note: "Now stand a face upright. Its two sides are one edge and the height.",
    pts: (d) => { const p = corners(d); return [p.B, p.B1, p.A]; },
  },
  {
    label: "short-face diagonal",
    col: 0x9b4fe0,
    right: 0,
    tex: (d) => `\\sqrt{${d.W}^2+${d.H}^2}=${texNum(Math.hypot(d.W, d.H))}`,
    note: "The other upright face gives a different pair of sides, so a different length.",
    pts: (d) => { const p = corners(d); return [p.C, p.C1, p.B]; },
  },
  {
    label: "space diagonal",
    col: 0xe8442a,
    right: 1,
    tex: (d) =>
      `\\sqrt{${d.L}^2+${d.W}^2+${d.H}^2}=${texNum(Math.hypot(d.L, d.W, d.H))}`,
    note: "This one goes right through the middle, corner to opposite corner. You cannot reach it in one step — first cross the base, then rise.",
    pts: (d) => { const p = corners(d); return [p.A, p.C, p.C1]; },
  },
  {
    label: "space diagonal, other way",
    col: 0xd93b85,
    right: 1,
    tex: (d) =>
      `\\sqrt{${d.W}^2+(${d.L}^2+${d.H}^2)}=${texNum(Math.hypot(d.L, d.W, d.H))}`,
    note: "Start from a different face and you still arrive. Same length, because the route does not matter.",
    pts: (d) => { const p = corners(d); return [p.A, p.B1, p.C1]; },
  },
  {
    label: "half the base",
    col: 0xf5901e,
    right: 2,
    tex: (d) =>
      `\\sqrt{${surd(d.L / 2)}^2+${d.W}^2}=${texNum(Math.hypot(d.L / 2, d.W))}`,
    note: "From the middle of an edge to the far corner. This one hides inside a lot of cuts.",
    pts: (d) => { const p = corners(d); return [mid(p.A, p.B), p.C, p.B]; },
  },
];

/** The cuts. Slice straight through and what you get back is a flat shape. */
export const CUBOID_SECS: FigSec[] = [
  {
    label: "diagonal section",
    col: 0xe39a22,
    tex: (d) =>
      `${texNum(Math.hypot(d.L, d.W))}\\times${d.H}=${texNum(Math.hypot(d.L, d.W) * d.H)}`,
    note: "Cut along the bottom diagonal and stand it up. Still a rectangle, just wider than any face.",
    quad: (d) => { const p = corners(d); return [p.A, p.C, p.C1, p.A1]; },
  },
  {
    label: "parallel to a face",
    col: 0x2b4fe8,
    tex: (d) => `${d.W}\\times${d.H}=${texNum(d.W * d.H)}`,
    note: "Cut parallel to a side and you get that side back, wherever you cut.",
    quad: (d) => {
      const p = corners(d), x = (p.A[0] + p.B[0]) / 2;
      return [[x, p.B[1], 0], [x, p.C[1], 0], [x, p.C[1], d.H], [x, p.B[1], d.H]];
    },
  },
  {
    label: "parallel to the base",
    col: 0x2fa84f,
    tex: (d) => `${d.L}\\times${d.W}=${texNum(d.L * d.W)}`,
    note: "Every level cut gives the base again. That is what makes this a prism.",
    quad: (d) => {
      const p = corners(d), z = d.H / 2;
      return [p.A, p.B, p.C, p.D].map((q): Pt => [q[0], q[1], z]);
    },
  },
  {
    label: "midpoint to corner",
    col: 0x8b5cf6,
    tex: (d) =>
      `${texNum(Math.hypot(d.L / 2, d.W))}\\times${d.H}=${texNum(Math.hypot(d.L / 2, d.W) * d.H)}`,
    note: "Start from the middle of an edge. Its width is not a diagonal, so work that out first.",
    quad: (d) => {
      const p = corners(d), m = mid(p.A, p.B);
      return [m, p.C, p.C1, [m[0], m[1], d.H]];
    },
  },
  {
    label: "corner cut",
    col: 0xd93b85,
    tex: (d) =>
      `\\text{sides }${texNum(Math.hypot(d.L, d.W))},\\;${texNum(Math.hypot(d.W, d.H))},\\;${texNum(Math.hypot(d.L, d.H))}`,
    note: "Slice one corner off. The three edges of the cut are three face diagonals.",
    // Three points, not four: the three vertices next to one corner. The scene
    // closes it as a degenerate quad.
    quad: (d) => { const p = corners(d); return [p.B, p.D, p.A1]; },
  },
];

/** Colours shared by every angle: the shadow on the base, and the upright. */
const SHADOW = 0x2b4fe8, UPRIGHT = 0xe39a22;

/**
 * The angles. Each is one leaning line, its shadow, and the upright that joins
 * them — because an angle off the base is always measured against the shadow.
 */
export const CUBOID_ANGS: FigAng[] = [
  {
    label: "space diagonal ∠ base",
    col: 0xe8442a,
    tex: (d) =>
      `\\tan\\alpha=\\frac{${d.H}}{${texNum(Math.hypot(d.L, d.W))}}\\;\\Rightarrow\\;${deg(Math.atan2(d.H, Math.hypot(d.L, d.W)))}^\\circ`,
    note: "The shadow of the space diagonal is the base diagonal.",
    lines: (d) => {
      const p = corners(d);
      return [
        [p.A, p.C1, 0xe8442a, 0.07],
        [p.A, p.C, SHADOW, 0.055],
        [p.C, p.C1, UPRIGHT, 0.045],
      ];
    },
    mark: (d) => {
      const p = corners(d);
      return [
        `${deg(Math.atan2(d.H, Math.hypot(d.L, d.W)))}°`,
        [p.A[0] + (p.C[0] - p.A[0]) * 0.3, p.A[1] + (p.C[1] - p.A[1]) * 0.3, d.H * 0.1],
      ];
    },
  },
  {
    label: "long-face diagonal ∠ base",
    col: 0x17a2a0,
    tex: (d) =>
      `\\tan\\beta=\\frac{${d.H}}{${d.L}}\\;\\Rightarrow\\;${deg(Math.atan2(d.H, d.L))}^\\circ`,
    note: "This one’s shadow is an edge, not a diagonal.",
    lines: (d) => {
      const p = corners(d);
      return [
        [p.A, p.B1, 0x17a2a0, 0.07],
        [p.A, p.B, SHADOW, 0.055],
        [p.B, p.B1, UPRIGHT, 0.045],
      ];
    },
    mark: (d) => {
      const p = corners(d);
      return [
        `${deg(Math.atan2(d.H, d.L))}°`,
        [p.A[0] + (p.B[0] - p.A[0]) * 0.32, p.A[1], d.H * 0.1],
      ];
    },
  },
  {
    label: "short-face diagonal ∠ base",
    col: 0x9b4fe0,
    tex: (d) =>
      `\\tan\\gamma=\\frac{${d.H}}{${d.W}}\\;\\Rightarrow\\;${deg(Math.atan2(d.H, d.W))}^\\circ`,
    note: "Shorter shadow, same height, so it leans more steeply.",
    lines: (d) => {
      const p = corners(d);
      return [
        [p.B, p.C1, 0x9b4fe0, 0.07],
        [p.B, p.C, SHADOW, 0.055],
        [p.C, p.C1, UPRIGHT, 0.045],
      ];
    },
    mark: (d) => {
      const p = corners(d);
      return [
        `${deg(Math.atan2(d.H, d.W))}°`,
        [p.B[0], p.B[1] + (p.C[1] - p.B[1]) * 0.32, d.H * 0.1],
      ];
    },
  },
  {
    label: "space diagonal ∠ a face",
    col: 0xd93b85,
    tex: (d) =>
      `\\tan\\delta=\\frac{${d.W}}{${texNum(Math.hypot(d.L, d.H))}}\\;\\Rightarrow\\;${deg(Math.atan2(d.W, Math.hypot(d.L, d.H)))}^\\circ`,
    note: "You can lean against an upright face too. Then the shadow is that face’s diagonal.",
    lines: (d) => {
      const p = corners(d);
      return [
        [p.A, p.C1, 0xd93b85, 0.07],
        [p.A, p.B1, SHADOW, 0.055],
        [p.B1, p.C1, UPRIGHT, 0.045],
      ];
    },
    mark: (d) => {
      const p = corners(d);
      return [
        `${deg(Math.atan2(d.W, Math.hypot(d.L, d.H)))}°`,
        [p.A[0] + (p.B[0] - p.A[0]) * 0.34, p.A[1], d.H * 0.34],
      ];
    },
  },
];
