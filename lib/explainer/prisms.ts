import type { Dims } from "./scene";
import {
  CUBOID_ANGS, CUBOID_NET_RULE, CUBOID_SECS, CUBOID_TRIS, CUBOID_VOL_RULE,
  corners, deg, mid, surd, texNum,
  type FigAng, type FigSec, type FigTri, type Pt,
} from "./cuboid-figures";

/**
 * The three figures the cuboid explainer can show, ported from the
 * base-polygon engine in legacy/topic-cuboid.html (SPEC / SIZES / baseRing,
 * and FIGDATA.triprism / FIGDATA.hexprism).
 *
 * The legacy page was one engine driving five figures through a module-global
 * `FIGID`; the port keeps the engine but passes the figure in, so every
 * function here is pure. The cuboid's own catalogues are not duplicated — they
 * already live in ./cuboid-figures and are re-listed in the maps at the foot
 * of this file.
 *
 * Deliberately free of any `three` import, for the same reason ./cuboid-figures
 * is: ./prism-layer draws from these point generators and the control panel
 * reads the same entries for its chips, so both sides read one list.
 */

const S3 = Math.sqrt(3);

export type PrismId = "cuboid" | "triprism" | "hexprism";
export const PRISM_IDS = ["cuboid", "triprism", "hexprism"] as const;

const isPrismId = (v: string): v is PrismId =>
  (PRISM_IDS as readonly string[]).includes(v);

/** Narrows a stored value; anything unrecognised reads as the cuboid. */
export const asPrismId = (v: string): PrismId => (isPrismId(v) ? v : "cuboid");

/* ============================================================
   the base polygon

   Every figure is a regular polygon swept straight up. Only the
   ring differs, so everything below is written once against it.

   The cuboid's ring is A B C D in the order ./cuboid-figures
   names them, which is what lets its catalogues keep using
   `corners()` while the drawing code walks the ring.
   ============================================================ */

function ringPts(n: number, R: number, rot: number): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = rot + (i * 2 * Math.PI) / n;
    p.push([R * Math.cos(t), R * Math.sin(t), 0]);
  }
  return p;
}

/**
 * The base ring, anticlockwise from `d.L` (the side `a` for the two regular
 * bases). A triangle's circumradius is a/√3 and a hexagon's is a, so both
 * rings have side length exactly `d.L`.
 */
export function baseRing(fig: PrismId, d: Dims): Pt[] {
  if (fig === "triprism") return ringPts(3, d.L / S3, -Math.PI / 2);
  if (fig === "hexprism") return ringPts(6, d.L, 0);
  const p = corners(d);
  return [p.A, p.B, p.C, p.D];
}

export const topRing = (fig: PrismId, d: Dims): Pt[] =>
  baseRing(fig, d).map((q): Pt => [q[0], q[1], d.H]);

const dist3 = (u: Pt, v: Pt) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2]);

/** Shoelace over the ring — exact for every base here. */
export function baseArea(fig: PrismId, d: Dims): number {
  const p = baseRing(fig, d);
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[i], t = p[(i + 1) % p.length];
    s += q[0] * t[1] - t[0] * q[1];
  }
  return Math.abs(s) / 2;
}

export function basePerim(fig: PrismId, d: Dims): number {
  const p = baseRing(fig, d);
  let s = 0;
  for (let i = 0; i < p.length; i++) s += dist3(p[i], p[(i + 1) % p.length]);
  return s;
}

/** Centre to a corner. */
export const circumR = (fig: PrismId, d: Dims): number => {
  const p = baseRing(fig, d);
  return Math.hypot(p[0][0], p[0][1]);
};

/** Centre to the middle of a side. */
export const inR = (fig: PrismId, d: Dims): number => {
  const p = baseRing(fig, d), m = mid(p[0], p[1]);
  return Math.hypot(m[0], m[1]);
};

export const sideLen = (fig: PrismId, d: Dims): number => {
  const p = baseRing(fig, d);
  return dist3(p[0], p[1]);
};

/** The longest diagonal of the base — 2a for a hexagon. */
export function widestDiag(fig: PrismId, d: Dims): number {
  const p = baseRing(fig, d);
  let m = 0;
  for (let i = 0; i < p.length; i++)
    for (let j = i + 1; j < p.length; j++) m = Math.max(m, dist3(p[i], p[j]));
  return m;
}

/** The short diagonal, the one that skips a single corner. 0 below five sides. */
export const shortDiag = (fig: PrismId, d: Dims): number => {
  const p = baseRing(fig, d);
  return p.length > 4 ? dist3(p[0], p[2]) : 0;
};

/** Two bases plus the band of rectangles around them. */
export const prismSurface = (fig: PrismId, d: Dims): number =>
  2 * baseArea(fig, d) + basePerim(fig, d) * d.H;

export const prismVolume = (fig: PrismId, d: Dims): number =>
  baseArea(fig, d) * d.H;

/* ============================================================
   what the sliders are called, and where each figure starts

   The two regular bases are described by one number, so their
   panel shows a and h rather than l, w and h. `a` writes both
   L and W so nothing downstream has to know the base is regular.
   ============================================================ */

export type DimKey = "l" | "w" | "h" | "a";

export const PRISM_KEYS: Readonly<Record<PrismId, readonly DimKey[]>> = {
  cuboid: ["l", "w", "h"],
  triprism: ["a", "h"],
  hexprism: ["a", "h"],
};

/** Each figure starts at its own proportions, as the original did. */
export const PRISM_SIZES: Readonly<Record<PrismId, Dims>> = {
  cuboid: { L: 6, W: 4, H: 3 },
  triprism: { L: 6, W: 6, H: 5 },
  hexprism: { L: 4, W: 4, H: 5 },
};

/* ============================================================
   the wording

   The cuboid spine asks the same six questions of every figure,
   and only the answers change. Titles never do, so they stay in
   ./beats; everything a slide says about *this* solid is here.

   Notes and bodies are plain text: the panel renders them as
   text nodes, so the <b> the original wrote into these strings
   would have shown as tags.
   ============================================================ */

export type PrismCopy = {
  /** The switcher's label for this figure. */
  name: string;
  sizes: string;
  net: string;
  netWhy: string;
  netRule: string;
  netTex: (d: Dims) => string;
  volBody: string;
  volWhy: string;
  volRule: string;
  /**
   * The volume as one expression. The prisms' sweep panel prints it; the
   * cuboid's counts cubes instead and never asks for it, but the entry is
   * kept so the record stays uniform.
   */
  volTex: (d: Dims) => string;
  triBody: string;
  triWhy: string;
  angBody: string;
};

export const PRISM_COPY: Readonly<Record<PrismId, PrismCopy>> = {
  cuboid: {
    name: "Cuboid",
    sizes: "This is a cuboid — a solid that looks like a box. It has three dimensions: length, width and height. Try changing them and watch everything follow.",
    net: "A cuboid is made of six flat rectangles. Unfold it and they all lie side by side — then the surface area is just their areas added up.",
    netWhy: "Opposite faces are identical, so there are really only three different rectangles to find, and each one appears twice.",
    netRule: CUBOID_NET_RULE,
    netTex: (d) =>
      `2(${d.L}\\cdot${d.W})+2(${d.L}\\cdot${d.H})+2(${d.W}\\cdot${d.H})=\\textbf{${prismSurface("cuboid", d)}}`,
    volBody: "Volume asks how much space is inside. So fill the box with cubes of side 1 and count them.",
    volWhy: "One layer holds l × w cubes, and there are h layers. Double every length and the surface grows four times, the volume eight.",
    volRule: CUBOID_VOL_RULE,
    volTex: (d) => `${d.L}\\cdot${d.W}\\cdot${d.H}=${d.L * d.W * d.H}`,
    triBody: "A cuboid has no triangles drawn on it. But join two corners and one appears — and a right triangle is something you already know how to handle.",
    triWhy: "Every one of these has the same shape: two sides you know, one you want. What changes is which two you start from.",
    angBody: "A line inside the box leans. To say how much, compare it with its own shadow on the floor.",
  },

  triprism: {
    name: "Triangular prism",
    sizes: "A triangular prism — the same triangle top and bottom, joined straight up. Two numbers describe it: the base side and the height.",
    net: "Two triangles and three rectangles, and that is the whole surface. Unfold it and you can see every piece at once.",
    netWhy: "The three rectangles are identical, because all three base edges are the same length.",
    netRule: "S = 2B + Ph,\\quad B = \\tfrac{\\sqrt3}{4}a^2",
    netTex: (d) =>
      `\\underbrace{2\\times${texNum(baseArea("triprism", d))}}_{\\text{two triangles}}+\\underbrace{3\\times${d.L}\\times${d.H}}_{\\text{three rectangles}}=\\textbf{${texNum(prismSurface("triprism", d))}}`,
    volBody: "Take the triangle at the bottom and sweep it straight up. Everything it passes through is the volume.",
    volWhy: "The base sweeps through the whole height without changing shape, so the volume is just the base area times the height.",
    volRule: "V = Bh",
    volTex: (d) =>
      `\\underbrace{${texNum(baseArea("triprism", d))}}_{\\text{triangle}}\\times${d.H}=${texNum(prismVolume("triprism", d))}`,
    triBody: "The triangles here come in two kinds: ones lying flat in the base, and ones standing up inside the solid.",
    triWhy: "An equilateral base is worth knowing well. Its height, its centre and its corners give you almost every length you will need.",
    angBody: "A diagonal drawn on a side face leans away from the base. Compare it with its shadow to say how much.",
  },

  hexprism: {
    name: "Hexagonal prism",
    sizes: "A hexagonal prism — a six-sided base raised straight up. Its side and its longest radius are the same length, which makes everything easier.",
    net: "Two hexagons and six rectangles. Unfold it and the six rectangles line up in a row.",
    netWhy: "A regular hexagon is six equilateral triangles meeting at the centre, so its area is six times one of them.",
    netRule: "S = 2B + Ph,\\quad B = \\tfrac{3\\sqrt3}{2}a^2",
    netTex: (d) =>
      `\\underbrace{2\\times${texNum(baseArea("hexprism", d))}}_{\\text{two hexagons}}+\\underbrace{6\\times${d.L}\\times${d.H}}_{\\text{six rectangles}}=\\textbf{${texNum(prismSurface("hexprism", d))}}`,
    volBody: "Take the hexagon at the bottom and sweep it straight up. Everything it passes through is the volume.",
    volWhy: "The base never changes shape as it rises, so the volume is the base area times the height.",
    volRule: "V = Bh",
    volTex: (d) =>
      `\\underbrace{${texNum(baseArea("hexprism", d))}}_{\\text{hexagon}}\\times${d.H}=${texNum(prismVolume("hexprism", d))}`,
    triBody: "A hexagon has two different diagonals, so it hides more triangles than you might expect.",
    triWhy: "Watch which diagonal you are standing on. The long one passes through the centre; the short one does not.",
    angBody: "A diagonal running through the solid leans away from the base. Compare it with its shadow down there.",
  },
};

/* ============================================================
   the catalogues

   Same three chip rows as the cuboid's, same entry shapes, so
   ./prism-layer and the panel treat every figure alike.
   ============================================================ */

const at = (q: Pt, z: number): Pt => [q[0], q[1], z];

/* ---- the triangular prism ---- */

const TRI_TRIS: FigTri[] = [
  {
    label: "height of the base",
    col: 0x2b4fe8,
    right: 2,
    tex: (d) => `h_\\triangle=\\tfrac{\\sqrt3}{2}\\times${d.L}=${texNum((S3 / 2) * d.L)}`,
    note: "The base’s own height. Everything about an equilateral triangle starts here.",
    pts: (d) => {
      const p = baseRing("triprism", d);
      return [p[2], p[0], mid(p[0], p[1])];
    },
  },
  {
    label: "centre: R and r",
    col: 0xe39a22,
    right: 2,
    tex: (d) =>
      `R=\\tfrac{${d.L}}{\\sqrt3}=${texNum(circumR("triprism", d))},\\quad r=\\tfrac{R}{2}=${texNum(inR("triprism", d))}`,
    note: "For an equilateral base R = 2r. Half of every prism and pyramid problem starts here.",
    pts: (d) => {
      const p = baseRing("triprism", d);
      return [p[0], [0, 0, 0], mid(p[0], p[1])];
    },
  },
  {
    label: "lateral face diagonal",
    col: 0xe8442a,
    right: 1,
    tex: (d) => `\\sqrt{${d.L}^2+${d.H}^2}=${texNum(Math.hypot(d.L, d.H))}`,
    note: "A lateral face is a rectangle, so its diagonal is one Pythagoras away.",
    pts: (d) => {
      const p = baseRing("triprism", d);
      return [p[0], p[1], at(p[1], d.H)];
    },
  },
  {
    label: "vertex to far top edge",
    col: 0x9b4fe0,
    right: 1,
    tex: (d) =>
      `\\sqrt{${texNum((S3 / 2) * d.L)}^2+${d.H}^2}=${texNum(Math.hypot((S3 / 2) * d.L, d.H))}`,
    note: "Across the inside: the base height, then straight up. The longest reach in the solid.",
    pts: (d) => {
      const p = baseRing("triprism", d), m = mid(p[1], p[2]);
      return [p[0], m, at(m, d.H)];
    },
  },
  {
    label: "top vertex to base vertex",
    col: 0x2fa84f,
    right: 1,
    tex: (d) => `\\sqrt{${d.L}^2+${d.H}^2}=${texNum(Math.hypot(d.L, d.H))}`,
    note: "Another lateral-face diagonal — every one of them is the same length.",
    pts: (d) => {
      const p = baseRing("triprism", d);
      return [p[1], p[2], at(p[2], d.H)];
    },
  },
];

const TRI_SECS: FigSec[] = [
  {
    label: "through a lateral edge",
    col: 0xe39a22,
    tex: (d) =>
      `${texNum((S3 / 2) * d.L)}\\times${d.H}=${texNum((S3 / 2) * d.L * d.H)}`,
    note: "Through one edge and the middle of the opposite face: the base height by h.",
    quad: (d) => {
      const p = baseRing("triprism", d), m = mid(p[1], p[2]);
      return [p[0], m, at(m, d.H), at(p[0], d.H)];
    },
  },
  {
    label: "parallel to the base",
    col: 0x2fa84f,
    tex: (d) => texNum(baseArea("triprism", d)),
    note: "Every horizontal cut is the base triangle again — that is what a prism is.",
    quad: (d) => baseRing("triprism", d).map((q) => at(q, d.H / 2)),
  },
  {
    label: "parallel to a face",
    col: 0x2b4fe8,
    tex: (d) => `\\tfrac12\\times${d.L}\\times${d.H}=${texNum((d.L * d.H) / 2)}`,
    note: "Slice parallel to a lateral face: the same rectangle shape, narrower.",
    quad: (d) => {
      const p = baseRing("triprism", d);
      const m1 = mid(p[0], p[2]), m2 = mid(p[1], p[2]);
      return [m1, m2, at(m2, d.H), at(m1, d.H)];
    },
  },
  {
    label: "corner cut",
    col: 0xd93b85,
    tex: (d) =>
      `\\text{sides }${texNum(d.L)},\;${texNum(Math.hypot(d.L, d.H))},\;${texNum(Math.hypot(d.L, d.H))}`,
    note: "Two base vertices and one top vertex — an isosceles triangle.",
    quad: (d) => {
      const p = baseRing("triprism", d);
      return [p[0], p[1], at(p[2], d.H)];
    },
  },
];

/** Colours shared by every angle: the shadow on the base, and the upright. */
const SHADOW = 0x2b4fe8, UPRIGHT = 0xe39a22;

const TRI_ANGS: FigAng[] = [
  {
    label: "face diagonal ∠ base",
    col: 0xe8442a,
    tex: (d) =>
      `\\tan\\alpha=\\frac{${d.H}}{${d.L}}\;\\Rightarrow\;${deg(Math.atan2(d.H, d.L))}^\\circ`,
    note: "It leans on the base edge it started from.",
    lines: (d) => {
      const p = baseRing("triprism", d);
      return [
        [p[0], at(p[1], d.H), 0xe8442a, 0.07],
        [p[0], p[1], SHADOW, 0.055],
        [p[1], at(p[1], d.H), UPRIGHT, 0.045],
      ];
    },
    mark: (d) => {
      const p = baseRing("triprism", d);
      return [
        `${deg(Math.atan2(d.H, d.L))}°`,
        [
          p[0][0] + (p[1][0] - p[0][0]) * 0.3,
          p[0][1] + (p[1][1] - p[0][1]) * 0.3,
          d.H * 0.12,
        ],
      ];
    },
  },
  {
    label: "long diagonal ∠ base",
    col: 0x9b4fe0,
    tex: (d) =>
      `\\tan\\beta=\\frac{${d.H}}{${texNum((S3 / 2) * d.L)}}\;\\Rightarrow\;${deg(Math.atan2(d.H, (S3 / 2) * d.L))}^\\circ`,
    note: "This one leans on the base height, not an edge — so it is shallower.",
    lines: (d) => {
      const p = baseRing("triprism", d), m = mid(p[1], p[2]);
      return [
        [p[0], at(m, d.H), 0x9b4fe0, 0.07],
        [p[0], m, SHADOW, 0.055],
        [m, at(m, d.H), UPRIGHT, 0.045],
      ];
    },
    mark: (d) => {
      const p = baseRing("triprism", d), m = mid(p[1], p[2]);
      return [
        `${deg(Math.atan2(d.H, (S3 / 2) * d.L))}°`,
        [
          p[0][0] + (m[0] - p[0][0]) * 0.3,
          p[0][1] + (m[1] - p[0][1]) * 0.3,
          d.H * 0.12,
        ],
      ];
    },
  },
];

/* ---- the hexagonal prism ---- */

const HEX_TRIS: FigTri[] = [
  {
    label: "the two base diagonals",
    // p0 p2 p3 is right-angled at p2: (a√3)² + a² = (2a)². The original left
    // this entry's `right` unset, which put the mark at a NaN corner.
    right: 1,
    col: 0x2b4fe8,
    tex: (d) =>
      `d_{\\text{short}}=a\\sqrt3=${texNum(shortDiag("hexprism", d))},\\quad d_{\\text{long}}=2a=${texNum(widestDiag("hexprism", d))}`,
    note: "A hexagon has two diagonals. Reaching for the wrong one is the usual slip.",
    pts: (d) => {
      const p = baseRing("hexprism", d);
      return [p[0], p[2], p[3]];
    },
  },
  {
    label: "the long space diagonal",
    col: 0xe8442a,
    right: 1,
    tex: (d) =>
      `d=\\sqrt{(2a)^2+h^2}=\\sqrt{${texNum(widestDiag("hexprism", d))}^2+${d.H}^2}=${texNum(Math.hypot(widestDiag("hexprism", d), d.H))}`,
    note: "Stands on the long diagonal, which passes through the centre.",
    pts: (d) => {
      const p = baseRing("hexprism", d);
      return [p[0], p[3], at(p[3], d.H)];
    },
  },
  {
    label: "the short space diagonal",
    col: 0xe39a22,
    right: 1,
    tex: (d) =>
      `d=\\sqrt{(a\\sqrt3)^2+h^2}=${texNum(Math.hypot(shortDiag("hexprism", d), d.H))}`,
    note: "Stands on the short diagonal instead — a different length entirely.",
    pts: (d) => {
      const p = baseRing("hexprism", d);
      return [p[0], p[2], at(p[2], d.H)];
    },
  },
];

const HEX_SECS: FigSec[] = [
  {
    label: "through the long diagonal",
    col: 0xe39a22,
    tex: (d) =>
      `S=2a\\cdot h=${texNum(widestDiag("hexprism", d))}\\cdot${d.H}=${texNum(widestDiag("hexprism", d) * d.H)}`,
    note: "The widest cut you can take: a rectangle 2a by h.",
    quad: (d) => {
      const p = baseRing("hexprism", d);
      return [p[0], p[3], at(p[3], d.H), at(p[0], d.H)];
    },
  },
  {
    label: "through the short diagonal",
    col: 0x2b4fe8,
    tex: (d) =>
      `S=a\\sqrt3\\cdot h=${texNum(shortDiag("hexprism", d))}\\cdot${d.H}=${texNum(shortDiag("hexprism", d) * d.H)}`,
    note: "A narrower rectangle, a√3 by h. Same shape, different width.",
    quad: (d) => {
      const p = baseRing("hexprism", d);
      return [p[0], p[2], at(p[2], d.H), at(p[0], d.H)];
    },
  },
];

/**
 * The hexagonal prism's angles.
 *
 * The original had no `angs` for this figure — its "How steep is it?" slide
 * fell back to a single unlabelled formula. These two are the same pair its
 * triangles already draw, read as angles: each space diagonal against the base
 * diagonal it stands on, which is what its angNote said in words.
 */
const HEX_ANGS: FigAng[] = [
  {
    label: "long diagonal ∠ base",
    col: 0xe8442a,
    tex: (d) =>
      `\\tan\\alpha=\\frac{h}{2a}=\\frac{${d.H}}{${texNum(widestDiag("hexprism", d))}}\;\\Rightarrow\;${deg(Math.atan2(d.H, widestDiag("hexprism", d)))}^\\circ`,
    note: "The long space diagonal leans on the long base diagonal, the one through the centre.",
    lines: (d) => {
      const p = baseRing("hexprism", d);
      return [
        [p[0], at(p[3], d.H), 0xe8442a, 0.07],
        [p[0], p[3], SHADOW, 0.055],
        [p[3], at(p[3], d.H), UPRIGHT, 0.045],
      ];
    },
    mark: (d) => {
      const p = baseRing("hexprism", d);
      return [
        `${deg(Math.atan2(d.H, widestDiag("hexprism", d)))}°`,
        [p[0][0] + (p[3][0] - p[0][0]) * 0.3, p[0][1], d.H * 0.12],
      ];
    },
  },
  {
    label: "short diagonal ∠ base",
    col: 0xe39a22,
    tex: (d) =>
      `\\tan\\beta=\\frac{h}{a\\sqrt3}=\\frac{${d.H}}{${texNum(shortDiag("hexprism", d))}}\;\\Rightarrow\;${deg(Math.atan2(d.H, shortDiag("hexprism", d)))}^\\circ`,
    note: "Shorter shadow, same height, so this one leans more steeply. Picking the wrong diagonal changes the answer.",
    lines: (d) => {
      const p = baseRing("hexprism", d);
      return [
        [p[0], at(p[2], d.H), 0xe39a22, 0.07],
        [p[0], p[2], SHADOW, 0.055],
        [p[2], at(p[2], d.H), UPRIGHT, 0.045],
      ];
    },
    mark: (d) => {
      const p = baseRing("hexprism", d);
      return [
        `${deg(Math.atan2(d.H, shortDiag("hexprism", d)))}°`,
        [
          p[0][0] + (p[2][0] - p[0][0]) * 0.3,
          p[0][1] + (p[2][1] - p[0][1]) * 0.3,
          d.H * 0.12,
        ],
      ];
    },
  },
];

/* ============================================================
   the maps the panel and the scene read
   ============================================================ */

export const PRISM_TRIS: Readonly<Record<PrismId, readonly FigTri[]>> = {
  cuboid: CUBOID_TRIS,
  triprism: TRI_TRIS,
  hexprism: HEX_TRIS,
};

export const PRISM_SECS: Readonly<Record<PrismId, readonly FigSec[]>> = {
  cuboid: CUBOID_SECS,
  triprism: TRI_SECS,
  hexprism: HEX_SECS,
};

export const PRISM_ANGS: Readonly<Record<PrismId, readonly FigAng[]>> = {
  cuboid: CUBOID_ANGS,
  triprism: TRI_ANGS,
  hexprism: HEX_ANGS,
};

/**
 * A chip index that is safe to hand the scene. The catalogues are different
 * lengths, so switching figures can leave an index past the end of the new
 * one; clamping here means neither side has to guard.
 */
export const clampIdx = (i: number, len: number): number =>
  len === 0 ? 0 : Math.max(0, Math.min(len - 1, Math.trunc(i)));

/** Used by the net and sweep labels, which read the same numbers the panel does. */
export const areaText = (v: number): string => surd(v);
