/** The four puzzle levels, ported from the LEVELS array in legacy/game.html. */

export type Pt = readonly [number, number, number];
export type Points = Record<string, Pt>;
export type Pair = readonly [string, string];
export type LenSpec = readonly [string, string, number];
export type AngSpec = readonly [string, string, string, number];

export type LevelKind = "box" | "pyramid" | "dihedral";

export type Level = {
  id: string;
  name: string;
  /** Shortest known route. */
  par: number;
  /** Moves allowed before the level locks. */
  budget: number;
  kind: LevelKind;
  tag: string;
  brief: string;
  pts: () => Points;
  order: readonly string[];
  /** Lengths the level starts you with. */
  lens: readonly LenSpec[];
  /** Angles the level starts you with. */
  angs: readonly AngSpec[];
  target: Pair;
  /** The dihedral fold, in degrees — Translate propagates it to the slid point. */
  foldAngle: number | null;
  /** The intended route, shown when a solve went over par. */
  route: readonly string[];
  wire: readonly Pair[];
};

export const XDEG = 60;
export const XR = (XDEG * Math.PI) / 180;

const BOX_WIRE: readonly Pair[] = [
  ["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"],
  ["A1", "B1"], ["B1", "C1"], ["C1", "D1"], ["D1", "A1"],
  ["A", "A1"], ["B", "B1"], ["C", "C1"], ["D", "D1"],
];

const BOX_PTS = (): Points => ({
  A: [0, 0, 0], B: [12, 0, 0], C: [12, 16, 0], D: [0, 16, 0],
  A1: [0, 0, 15], B1: [12, 0, 15], C1: [12, 16, 15], D1: [0, 16, 15],
});

export const LEVELS: readonly Level[] = [
  {
    id: "facediag",
    name: "The flat one",
    par: 1,
    budget: 2,
    kind: "box",
    tag: "A diagonal you can walk around",
    brief:
      "AC crosses the bottom face. No edge gives it to you — but a right angle is already sitting there.",
    pts: BOX_PTS,
    order: ["A", "B", "C", "D", "A1", "B1", "C1", "D1"],
    lens: [["A", "B", 12], ["B", "C", 16]],
    angs: [["A", "B", "C", 90]],
    target: ["A", "C"],
    foldAngle: null,
    route: ["Pythagoras on A, B, C — the right angle at B was given."],
    wire: BOX_WIRE,
  },
  {
    id: "spacediag",
    name: "Through the middle",
    par: 2,
    budget: 3,
    kind: "box",
    tag: "Now leave the surface",
    brief:
      "AC₁ cuts through the inside. It lies on no face — so build something flat that gets you halfway.",
    pts: BOX_PTS,
    order: ["A", "B", "C", "D", "A1", "B1", "C1", "D1"],
    lens: [["A", "B", 12], ["B", "C", 16], ["C", "C1", 15]],
    angs: [["A", "B", "C", 90], ["A", "C", "C1", 90]],
    target: ["A", "C1"],
    foldAngle: null,
    route: [
      "Pythagoras on A, B, C → AC = 20",
      "Pythagoras on A, C, C₁ → AC₁ = 25",
    ],
    wire: BOX_WIRE,
  },
  {
    id: "pyramid",
    name: "Above the centre",
    par: 3,
    budget: 4,
    kind: "pyramid",
    tag: "The apex is not over a corner",
    brief:
      "S sits above O, the centre of the base. To climb up, first cross the base — O is the midpoint of its diagonal.",
    pts: () => ({
      A: [-6, -6, 0], B: [6, -6, 0], C: [6, 6, 0], D: [-6, 6, 0],
      O: [0, 0, 0], S: [0, 0, 7],
    }),
    order: ["A", "B", "C", "D", "O", "S"],
    lens: [["A", "B", 12], ["B", "C", 12], ["S", "O", 7]],
    angs: [
      ["A", "B", "C", 90], ["B", "C", "D", 90],
      ["A", "O", "S", 90], ["B", "O", "S", 90],
      ["C", "O", "S", 90], ["D", "O", "S", 90],
    ],
    target: ["S", "A"],
    foldAngle: null,
    route: [
      "Pythagoras on A, B, C → the base diagonal AC",
      "Midpoint on A, O, C → AO, half of it",
      "Pythagoras on A, O, S → SA = 11",
    ],
    wire: [
      ["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"],
      ["A", "S"], ["B", "S"], ["C", "S"], ["D", "S"],
      ["A", "C"], ["B", "D"], ["O", "S"],
    ],
  },
  {
    id: "dihedral",
    name: "Across the fold",
    par: 3,
    budget: 4,
    kind: "dihedral",
    tag: "Two faces, one hinge",
    brief:
      "A and B sit on two faces of a fold. The angle is given — but the two perpendiculars start in different places.",
    pts: () => ({
      A1: [0, 0, 0], B1: [5, 0, 0], A: [0, 3, 0],
      B: [5, 4 * Math.cos(XR), 4 * Math.sin(XR)],
    }),
    order: ["A", "B", "A1", "B1"],
    lens: [["A", "A1", 3], ["B", "B1", 4], ["A1", "B1", 5]],
    angs: [["A", "A1", "B1", 90], ["B", "B1", "A1", 90]],
    target: ["A", "B"],
    foldAngle: XDEG,
    route: [
      "Parallel translation on A, A₁, B₁ → the new point A₂",
      "Law of cosines on A₂, B₁, B → A₂B",
      "Pythagoras on A, A₂, B → AB = √38",
    ],
    wire: [["A", "A1"], ["B", "B1"], ["A1", "B1"], ["A", "B"]],
  },
];
