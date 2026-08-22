import type { Level, Points } from "./levels";

/**
 * The puzzle's rules, ported from legacy/game.html.
 *
 * The original mutated module-level globals and restored them from snapshots
 * to undo, to simulate a move, and to search for the shortest route. Here a
 * move is a pure function of state, so undo is a stack of states, simulation
 * is just calling the tool, and the search needs no save/restore at all. The
 * geometry each tool performs is unchanged.
 */

export type GameState = {
  PT: Points;
  ORDER: readonly string[];
  /** Keyed "P|Q" with P < Q. */
  knownLen: Readonly<Record<string, number>>;
  /** Keyed "P~R@Q" — the angle at Q, between QP and QR. */
  knownAng: Readonly<Record<string, number>>;
};

export type ToolName = "Translate" | "Midpoint" | "Law of cosines" | "Pythagoras";

export type MoveResult = {
  tri: [string, string, string];
  title: ToolName;
  tex: string;
  gained: string[];
  note: string;
  /** Length key to flash on the figure. */
  freshKey: string | null;
};

export type Move = { state: GameState; result: MoveResult };

/* ============================================================
   keys, formatting, measurement
   ============================================================ */

export const keyOf = (p: string, q: string) => (p < q ? `${p}|${q}` : `${q}|${p}`);
export const angKey = (p: string, q: string, r: string) =>
  `${[p, r].sort().join("~")}@${q}`;

/** A₁ rather than A1. */
export const nm = (k: string) =>
  k.replace(/[123]/g, (d) => ({ "1": "₁", "2": "₂", "3": "₃" })[d]!);
export const disp = (p: string, q: string) => nm(p) + nm(q);

export const getLen = (s: GameState, p: string, q: string): number | undefined =>
  s.knownLen[keyOf(p, q)];
export const getAng = (s: GameState, p: string, q: string, r: string): number | undefined =>
  s.knownAng[angKey(p, q, r)];

export const dist = (PT: Points, p: string, q: string) =>
  Math.hypot(PT[p][0] - PT[q][0], PT[p][1] - PT[q][1], PT[p][2] - PT[q][2]);

export function angleAt(PT: Points, p: string, q: string, r: string) {
  const u = [PT[p][0] - PT[q][0], PT[p][1] - PT[q][1], PT[p][2] - PT[q][2]];
  const v = [PT[r][0] - PT[q][0], PT[r][1] - PT[q][1], PT[r][2] - PT[q][2]];
  const d =
    (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) /
    (Math.hypot(u[0], u[1], u[2]) * Math.hypot(v[0], v[1], v[2]));
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
}

/** For TeX: exact surds stay exact. */
export function fmt(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  const sq = v * v;
  if (Math.abs(sq - Math.round(sq)) < 1e-7) return `\\sqrt{${Math.round(sq)}}`;
  return v.toFixed(2);
}

/** The same, for plain text labels. */
export function fmtPlain(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  const sq = v * v;
  if (Math.abs(sq - Math.round(sq)) < 1e-7) return "√" + Math.round(sq);
  return v.toFixed(2);
}

function freeName(order: readonly string[], base: string) {
  const stem = base.replace(/[0-9]+$/, "");
  for (let i = 2; i < 9; i++) if (!order.includes(stem + i)) return stem + i;
  return stem + "9";
}

export function initialState(level: Level): GameState {
  const knownLen: Record<string, number> = {};
  const knownAng: Record<string, number> = {};
  level.lens.forEach((e) => { knownLen[keyOf(e[0], e[1])] = e[2]; });
  level.angs.forEach((e) => { knownAng[angKey(e[0], e[1], e[2])] = e[3]; });
  return { PT: level.pts(), ORDER: [...level.order], knownLen, knownAng };
}

export const isSolved = (s: GameState, level: Level) =>
  getLen(s, level.target[0], level.target[1]) !== undefined;

/* ============================================================
   the four tools
   ============================================================ */

export type Tool = {
  name: ToolName;
  needs: string;
  /** What this tool would do with the current selection. */
  blurb: (s: GameState, picks: readonly string[]) => string;
  ok: (s: GameState, picks: readonly string[]) => boolean;
  /** Pure: returns the next state, never mutates the one passed in. */
  run: (s: GameState, picks: readonly string[], level: Level) => Move;
};

const triples = (picks: readonly string[]): [string, string, string][] => [
  [picks[0], picks[1], picks[2]],
  [picks[1], picks[2], picks[0]],
  [picks[2], picks[0], picks[1]],
];

/** Two known segments meeting at one of the three picked points. */
function findCorner(s: GameState, picks: readonly string[]) {
  if (picks.length !== 3) return null;
  for (let i = 0; i < 3; i++) {
    const q = picks[i];
    const o = picks.filter((x) => x !== q);
    if (getLen(s, q, o[0]) !== undefined && getLen(s, q, o[1]) !== undefined)
      return { q, p: o[0], r: o[1] };
  }
  return null;
}

function findMidpoint(s: GameState, picks: readonly string[]) {
  if (picks.length !== 3) return null;
  for (const [m, p, q] of triples(picks)) {
    const d1 = dist(s.PT, p, m), d2 = dist(s.PT, m, q), dd = dist(s.PT, p, q);
    // m must actually lie halfway along pq.
    if (Math.abs(d1 - d2) > 1e-9 || Math.abs(d1 + d2 - dd) > 1e-9) continue;
    const kp = getLen(s, p, m) !== undefined;
    const kq = getLen(s, m, q) !== undefined;
    const kw = getLen(s, p, q) !== undefined;
    if (kw && !(kp && kq)) return { m, p, q, mode: "half" as const };
    if ((kp || kq) && !kw) return { m, p, q, mode: "double" as const };
    if (kp && !kq) return { m, p, q, mode: "mirror" as const };
    if (kq && !kp) return { m, p: q, q: p, mode: "mirror" as const };
  }
  return null;
}

function findCos(s: GameState, picks: readonly string[]) {
  if (picks.length !== 3) return null;
  for (const [p, q, r] of triples(picks)) {
    if (
      getLen(s, q, p) !== undefined && getLen(s, q, r) !== undefined &&
      getAng(s, p, q, r) !== undefined && getLen(s, p, r) === undefined
    ) return { p, q, r };
  }
  return null;
}

function findPyth(s: GameState, picks: readonly string[]) {
  if (picks.length !== 3) return null;
  for (const [p, q, r] of triples(picks)) {
    if (getAng(s, p, q, r) !== 90) continue;
    const lp = getLen(s, q, p), lr = getLen(s, q, r), h = getLen(s, p, r);
    if (lp !== undefined && lr !== undefined && h === undefined)
      return { p, q, r, mode: "hyp" as const };
    if (h !== undefined && lp !== undefined && lr === undefined)
      return { p, q, r, mode: "leg" as const, known: lp, m1: q, m2: r };
    if (h !== undefined && lr !== undefined && lp === undefined)
      return { p, q, r, mode: "leg" as const, known: lr, m1: q, m2: p };
  }
  return null;
}

const withLen = (s: GameState, p: string, q: string, v: number): GameState => ({
  ...s, knownLen: { ...s.knownLen, [keyOf(p, q)]: v },
});

export const TOOLS: readonly Tool[] = [
  {
    name: "Translate",
    needs: "Three points, two known segments meeting at one.",
    blurb: (s, picks) => {
      const f = findCorner(s, picks);
      return f ? `Slide into a parallelogram at ${nm(f.q)}.`
               : "Three points, two known segments meeting at one.";
    },
    ok: (s, picks) => !!findCorner(s, picks),
    run: (s, picks, level) => {
      const f = findCorner(s, picks)!;
      const { p, q, r } = f;
      const np: [number, number, number] = [
        s.PT[p][0] + s.PT[r][0] - s.PT[q][0],
        s.PT[p][1] + s.PT[r][1] - s.PT[q][1],
        s.PT[p][2] + s.PT[r][2] - s.PT[q][2],
      ];
      const name = freeName(s.ORDER, p);

      const PT: Points = { ...s.PT, [name]: np };
      const ORDER = [...s.ORDER, name];
      const knownLen = { ...s.knownLen };
      const knownAng = { ...s.knownAng };
      const gained: string[] = [];

      const lenPQ = getLen(s, p, q)!, lenQR = getLen(s, q, r)!;
      knownLen[keyOf(name, r)] = lenPQ;
      gained.push(`${disp(name, r)} = ${fmtPlain(lenPQ)}`);
      knownLen[keyOf(p, name)] = lenQR;
      gained.push(`${disp(p, name)} = ${fmtPlain(lenQR)}`);

      // Sliding a perpendicular across the hinge carries the fold angle with
      // it — that is the whole point of the move in the dihedral level.
      ORDER.forEach((o) => {
        if (o === name || o === r) return;
        if (
          level.foldAngle !== null &&
          Math.abs(angleAt(PT, name, r, o) - level.foldAngle) < 1e-6 &&
          knownAng[angKey(name, r, o)] === undefined
        ) {
          knownAng[angKey(name, r, o)] = level.foldAngle;
          gained.push(`∠${nm(name)}${nm(r)}${nm(o)} = ${level.foldAngle}°`);
        }
      });
      ORDER.forEach((o) => {
        if (o === name || o === p) return;
        if (
          Math.abs(angleAt(PT, p, name, o) - 90) < 1e-6 &&
          knownAng[angKey(p, name, o)] === undefined
        ) {
          knownAng[angKey(p, name, o)] = 90;
          gained.push(`∠${nm(p)}${nm(name)}${nm(o)} = 90°`);
        }
      });

      return {
        state: { PT, ORDER, knownLen, knownAng },
        result: {
          tri: [p, q, r], title: "Translate",
          tex: `${disp(name, r)}=${disp(p, q)}=${fmt(lenPQ)}`,
          gained,
          note: `${nm(name)} is ${nm(p)} slid across — same length, new address.`,
          freshKey: keyOf(name, r),
        },
      };
    },
  },
  {
    name: "Midpoint",
    needs: "Two ends and the middle point, any order.",
    blurb: (s, picks) => {
      const f = findMidpoint(s, picks);
      return f ? `${nm(f.m)} is halfway along ${disp(f.p, f.q)}.`
               : "Two ends and the middle point, any order.";
    },
    ok: (s, picks) => !!findMidpoint(s, picks),
    run: (s, picks) => {
      const f = findMidpoint(s, picks)!;
      if (f.mode === "half") {
        const h = getLen(s, f.p, f.q)! / 2;
        let next = withLen(s, f.p, f.m, h);
        next = withLen(next, f.m, f.q, h);
        return {
          state: next,
          result: {
            tri: [f.p, f.m, f.q], title: "Midpoint",
            tex: `${disp(f.p, f.m)}=${disp(f.m, f.q)}=\\tfrac{1}{2}${disp(f.p, f.q)}=${fmt(h)}`,
            gained: [`${disp(f.p, f.m)} = ${fmtPlain(h)}`, `${disp(f.m, f.q)} = ${fmtPlain(h)}`],
            note: "Both halves match.",
            freshKey: keyOf(f.p, f.m),
          },
        };
      }
      if (f.mode === "double") {
        const half = getLen(s, f.p, f.m) ?? getLen(s, f.m, f.q)!;
        let next = withLen(s, f.p, f.q, 2 * half);
        next = withLen(next, f.p, f.m, half);
        next = withLen(next, f.m, f.q, half);
        return {
          state: next,
          result: {
            tri: [f.p, f.m, f.q], title: "Midpoint",
            tex: `${disp(f.p, f.q)}=2\\cdot ${fmt(half)}=${fmt(2 * half)}`,
            gained: [`${disp(f.p, f.q)} = ${fmtPlain(2 * half)}`],
            note: "Half is known, so the whole is twice it.",
            freshKey: keyOf(f.p, f.q),
          },
        };
      }
      const v = getLen(s, f.p, f.m)!;
      return {
        state: withLen(s, f.m, f.q, v),
        result: {
          tri: [f.p, f.m, f.q], title: "Midpoint",
          tex: `${disp(f.m, f.q)}=${disp(f.p, f.m)}=${fmt(v)}`,
          gained: [`${disp(f.m, f.q)} = ${fmtPlain(v)}`],
          note: "The other half matches.",
          freshKey: keyOf(f.m, f.q),
        },
      };
    },
  },
  {
    name: "Law of cosines",
    needs: "Two sides and the angle between them.",
    blurb: () => "Two sides and the angle between them.",
    ok: (s, picks) => !!findCos(s, picks),
    run: (s, picks) => {
      const f = findCos(s, picks)!;
      const s1 = getLen(s, f.q, f.p)!, s2 = getLen(s, f.q, f.r)!;
      const ang = getAng(s, f.p, f.q, f.r)!;
      const v = Math.sqrt(s1 * s1 + s2 * s2 - 2 * s1 * s2 * Math.cos((ang * Math.PI) / 180));
      return {
        state: withLen(s, f.p, f.r, v),
        result: {
          tri: [f.p, f.q, f.r], title: "Law of cosines",
          tex: `${disp(f.p, f.r)}^2=${fmt(s1)}^2+${fmt(s2)}^2-2\\cdot ${fmt(s1)}\\cdot ${fmt(s2)}\\cos ${ang}^\\circ`,
          gained: [`${disp(f.p, f.r)} = ${fmtPlain(v)}`],
          note: "Two sides and the angle between them.",
          freshKey: keyOf(f.p, f.r),
        },
      };
    },
  },
  {
    name: "Pythagoras",
    needs: "A right angle and two sides.",
    blurb: () => "A right angle and two sides.",
    ok: (s, picks) => !!findPyth(s, picks),
    run: (s, picks) => {
      const f = findPyth(s, picks)!;
      if (f.mode === "hyp") {
        const l1 = getLen(s, f.q, f.p)!, l2 = getLen(s, f.q, f.r)!;
        const v = Math.hypot(l1, l2);
        return {
          state: withLen(s, f.p, f.r, v),
          result: {
            tri: [f.p, f.q, f.r], title: "Pythagoras",
            tex: `${disp(f.p, f.r)}^2=${fmt(l1)}^2+${fmt(l2)}^2`,
            gained: [`${disp(f.p, f.r)} = ${fmtPlain(v)}`],
            note: `Right angle at ${nm(f.q)} — legs give the long side.`,
            freshKey: keyOf(f.p, f.r),
          },
        };
      }
      const hyp = getLen(s, f.p, f.r)!;
      const v = Math.sqrt(hyp * hyp - f.known * f.known);
      return {
        state: withLen(s, f.m1, f.m2, v),
        result: {
          tri: [f.p, f.q, f.r], title: "Pythagoras",
          tex: `${disp(f.m1, f.m2)}^2=${fmt(hyp)}^2-${fmt(f.known)}^2`,
          gained: [`${disp(f.m1, f.m2)} = ${fmtPlain(v)}`],
          note: `Right angle at ${nm(f.q)} — leg out of the long side.`,
          freshKey: keyOf(f.m1, f.m2),
        },
      };
    },
  },
];

/* ============================================================
   how far is the target from here?
   ============================================================ */

/** Cheaper tools rank lower; used to spot a heavier move that was not needed. */
export const RANK: Record<ToolName, number> = {
  Pythagoras: 1, Midpoint: 1, "Law of cosines": 2, Translate: 3,
};

const stateKey = (s: GameState) =>
  `${s.ORDER.length}|${Object.keys(s.knownLen).sort().join(",")}|${Object.keys(s.knownAng).sort().join(",")}`;

/**
 * Exhaustive search over every three-point selection and every tool, bounded
 * by the moves left. Returns Infinity when the target is unreachable inside
 * that budget — which is what lets the game warn you that a move closed the
 * door rather than letting you find out four moves later.
 */
export function movesLeft(
  s: GameState,
  level: Level,
  limit: number,
  memo: Map<string, number> = new Map(),
): number {
  if (isSolved(s, level)) return 0;
  if (limit <= 0) return Infinity;
  const k = `${stateKey(s)}#${limit}`;
  const hit = memo.get(k);
  if (hit !== undefined) return hit;

  let best = Infinity;
  const pts = s.ORDER;
  outer: for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      for (let m = j + 1; m < pts.length; m++) {
        const picks = [pts[i], pts[j], pts[m]];
        for (const t of TOOLS) {
          let ok = false;
          try { ok = t.ok(s, picks); } catch { ok = false; }
          if (!ok) continue;
          let next: GameState;
          try { next = t.run(s, picks, level).state; } catch { continue; }
          const r = movesLeft(next, level, Math.min(limit, best) - 1, memo);
          if (r + 1 < best) {
            best = r + 1;
            if (best === 1) break outer;
          }
        }
      }
  memo.set(k, best);
  return best;
}

/* ============================================================
   nudges
   ============================================================ */

const NUDGE: Record<string, string> = {
  "Law of cosines>Pythagoras":
    "That angle is 90° — <b>Pythagoras</b> gets the same number with half the writing.",
  "Law of cosines>Midpoint":
    "<b>Midpoint</b> had it straight away — that point is halfway along.",
  "Translate>Pythagoras": "No new point needed — <b>Pythagoras</b> would have done it.",
  "Translate>Midpoint": "No new point needed — <b>Midpoint</b> unlocks the same length.",
  "Translate>Law of cosines":
    "A move spent on a point you did not need — <b>Law of cosines</b> already reached it.",
};

const gainedKeys = (before: GameState, after: GameState) =>
  Object.keys(after.knownLen).filter((k) => !(k in before.knownLen)).sort();

const sameGain = (a: string[], b: string[]) =>
  a.length > 0 && a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Speaks up only when a lighter tool would have reached the very same lengths,
 * so the game never nags about a move that genuinely did something different.
 */
export function nudgeFor(
  s: GameState,
  picks: readonly string[],
  chosen: Tool,
  chosenGain: string[],
  level: Level,
): string | null {
  const mine = RANK[chosen.name];
  let best: Tool | null = null;
  for (const t of TOOLS) {
    if (t === chosen || RANK[t.name] >= mine) continue;
    let ok = false;
    try { ok = t.ok(s, picks); } catch { ok = false; }
    if (!ok) continue;
    let gain: string[];
    try { gain = gainedKeys(s, t.run(s, picks, level).state); } catch { continue; }
    if (!sameGain(gain, chosenGain)) continue;
    if (!best || RANK[t.name] < RANK[best.name]) best = t;
  }
  if (!best) return null;
  return NUDGE[`${chosen.name}>${best.name}`] ?? `<b>${best.name}</b> gets there with less work.`;
}

export { gainedKeys };
