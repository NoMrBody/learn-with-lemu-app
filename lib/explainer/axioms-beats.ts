import type { AxiomFigure } from "./axioms-scene";

/**
 * The beats of the axioms explainer, ported from the SCREENS array in
 * legacy/axioms.html.
 *
 * The original was eleven imperative DOM builders; this is the same eleven
 * screens as data, with the prose carried over word for word. Two parallel
 * arrays there become fields here: AXOF (which axiom a screen belongs to) is
 * `axiom`, and POCKET (which axiom a screen banks) is `collects`.
 *
 * Deliberately separate from lib/explainer/beats.tsx rather than folded into
 * it. That file's `Beat.solids`, `UserState.solid` and `ControlKind` are all
 * shaped around a box or a pyramid being on screen; axioms has no solid, and
 * widening those types to admit a topic that never uses them would make every
 * box/pyramid beat carry a field that means nothing to it.
 */

/** Which axiom a screen belongs to. 0 in the original's AXOF is `undefined` here. */
export type AxiomNo = 1 | 2 | 3;

/**
 * A line of the running commentary. `hot` is the original's `.say.hot` — the
 * question that sets up the whole topic. `aside` is `.aside`, a remark rather
 * than a step. `mono` is the symbolic line on the intersection screen.
 */
export type Line = { text: string; tone?: "hot" | "aside" | "mono" };

export type Card = { mark: string; lead: string; then: string; axiom: AxiomNo };

export type AxiomBeat = {
  eyebrow?: string;
  title?: string;
  body: Line[];
  /** Replaces `body` once the screen's interaction has been carried out. */
  bodyDone?: Line[];
  /**
   * The reveal: the formal sentence types out, dims, and the plain reading
   * takes its place. Present on the three statement screens only.
   */
  formal?: string;
  symbol?: string;
  plain?: string;
  /** A word in `plain` worth explaining, shown on hover and on focus. */
  plainTerm?: { word: string; meaning: string };
  /** The accented aside under the body — "First axiom: in the pocket." */
  note?: string;
  /** Shown instead of `bodyDone` when the learner's three points line up. */
  warn?: string;
  /** A drawn aside in the panel rather than on the stage. */
  panelFigure?: "legs" | "ruler";
  cards?: Card[];
  figure: AxiomFigure;
  /** 'reset' is the "Try again" button; 'slide' is the α/β scrubber. */
  control: "none" | "reset" | "slide";
  axiom?: AxiomNo;
  collects?: AxiomNo;
  /** The line over the stage, before and after the interaction. */
  hint?: string;
  hintDone?: string;
};

/** The remark that appears as the formal sentence dims. */
export const FORMAL_ASIDE = "you do not have to keep that sentence — keep the idea";

export const AXIOM_BEATS: AxiomBeat[] = [
  /* ---------- 0 · why axioms ---------- */
  {
    title: "Before we start...",
    body: [
      { text: "Mathematics is a precise game. We don’t just say something is true — we need a reason." },
      { text: "But if we had to prove EVERYTHING... where would we start?", tone: "hot" },
      { text: "We need a few starting truths that we accept without proving them first. These are called axioms." },
      { text: "Think of them as the foundation of mathematics. We build everything else on top of them.", tone: "aside" },
      { text: "Stereometry has 3 fundamental axioms about points, lines and planes. Let’s discover them." },
    ],
    figure: "none",
    control: "none",
  },

  /* ---------- 1 · axiom 1, statement ---------- */
  {
    eyebrow: "Axiom 1",
    body: [],
    formal: "Through any three non-collinear points, there is exactly one plane.",
    plain: "3 non-collinear points lock exactly one plane.",
    plainTerm: { word: "non-collinear", meaning: "not all on one straight line" },
    figure: "plane3pts",
    control: "none",
    axiom: 1,
    hint: "drag to turn it around",
  },

  /* ---------- 2 · axiom 1, experiment ---------- */
  {
    eyebrow: "Axiom 1",
    title: "Try it yourself",
    body: [{ text: "Click anywhere in space to place 3 points." }],
    bodyDone: [{ text: "Three points → one plane." }],
    warn: "Keep the 3 points off one straight line.",
    figure: "pick3",
    control: "reset",
    axiom: 1,
    hint: "click to place a point",
    hintDone: "drag to turn it around",
  },

  /* ---------- 3 · axiom 1, memory ---------- */
  {
    eyebrow: "Axiom 1",
    title: "Why three?",
    body: [
      { text: "Three non-collinear points are the minimum needed to lock a plane in space." },
    ],
    note: "First axiom: in the pocket.",
    panelFigure: "legs",
    figure: "planeFlat",
    control: "none",
    axiom: 1,
    collects: 1,
  },

  /* ---------- 4 · axiom 2, statement ---------- */
  {
    eyebrow: "Axiom 2",
    body: [],
    formal: "A line containing two points of a plane lies entirely in that plane.",
    symbol: "A, B ∈ α  ⇒  AB ⊂ α",
    plain: "Two points of a line on a plane → the whole line is on that plane.",
    figure: "lineInPlane",
    control: "none",
    axiom: 2,
    hint: "drag to turn it around",
  },

  /* ---------- 5 · axiom 2, experiment ---------- */
  {
    eyebrow: "Axiom 2",
    title: "Try it",
    body: [{ text: "Choose 2 points on the plane." }],
    bodyDone: [
      { text: "A and B are on the plane. So the whole line AB is on the plane." },
    ],
    figure: "pick2OnPlane",
    control: "reset",
    axiom: 2,
    hint: "click a spot on the plane",
    hintDone: "drag to turn it around",
  },

  /* ---------- 6 · axiom 2, memory ---------- */
  {
    eyebrow: "Axiom 2",
    title: "A ruler on a table.",
    body: [
      { text: "2 points of a line are enough to know that the entire line belongs to the plane." },
    ],
    note: "Second axiom: in the pocket.",
    panelFigure: "ruler",
    figure: "none",
    control: "none",
    axiom: 2,
    collects: 2,
  },

  /* ---------- 7 · axiom 3, statement ---------- */
  {
    eyebrow: "Axiom 3",
    body: [],
    formal: "If two planes have a common point, then they have a common line through that point.",
    symbol: "α ∩ β = l",
    plain: "Two intersecting planes share a line.",
    figure: "twoPlanes",
    control: "none",
    axiom: 3,
    hint: "drag to turn it around",
  },

  /* ---------- 8 · axiom 3, experiment ---------- */
  {
    eyebrow: "Axiom 3",
    title: "Move plane β",
    body: [{ text: "Drag plane β toward plane α." }],
    bodyDone: [
      { text: "α ∩ β = l", tone: "mono" },
      { text: "The two planes don’t meet at just one point. Their common part is a line." },
    ],
    figure: "planeSlide",
    control: "slide",
    axiom: 3,
    hint: "drag the slider",
    hintDone: "drag to inspect the line",
  },

  /* ---------- 9 · axiom 3, memory ---------- */
  {
    eyebrow: "Axiom 3",
    body: [
      { text: "Think of two walls meeting in a room. Their common edge is a line." },
    ],
    note: "Third axiom: in the pocket.",
    figure: "corner",
    control: "none",
    axiom: 3,
    collects: 3,
  },

  /* ---------- 10 · the toolkit ---------- */
  {
    title: "Your stereometry toolkit",
    cards: [
      { mark: "①", lead: "3 non-collinear points", then: "→ exactly 1 plane", axiom: 1 },
      { mark: "②", lead: "2 points of a line on a plane", then: "→ the whole line is on the plane", axiom: 2 },
      { mark: "③", lead: "2 intersecting planes", then: "→ their common part is a line", axiom: 3 },
    ],
    body: [
      { text: "These are our starting truths. We will use them to build the rest of stereometry." },
      { text: "Now let’s see what we can deduce from them.", tone: "aside" },
    ],
    figure: "toolkit",
    control: "none",
  },
];

/**
 * Which axioms have been banked by the time the reader reaches `beat`. Reads
 * `collects` forwards rather than storing a running total, so paging backwards
 * empties the strip again — the original's POCKET.slice(0, idx + 1).
 */
export function collectedBy(beat: number): AxiomNo[] {
  return AXIOM_BEATS.slice(0, beat + 1)
    .map((b) => b.collects)
    .filter((a): a is AxiomNo => a !== undefined);
}
