import type { Pt, Points, View } from "./geometry";

/**
 * The problem sets, ported from the PROBLEMS array in legacy/problems.html.
 *
 * Unlike the explainer beats, the box and the pyramid do NOT share these: each
 * topic has its own set, selected by `getProblems(topicSlug)` at the bottom of
 * this file. BOX_PROBLEMS opens with the two cuboid problems, then the four
 * dihedral-angle exercises.
 *
 * Prose keeps the original `$…$` maths and `<b>` emphasis as authored, so it
 * still diffs cleanly against the legacy file; lib/problems/rich.tsx turns
 * that into React nodes at render time.
 *
 * Two TeX conventions live side by side, and they are not interchangeable:
 * every prose field (including `Step.ask.opts[].v`) goes through `Rich` and so
 * writes maths as `$…$`, while `Step.tex`, `Problem.answer` and
 * `Problem.options[].v` go straight to <M> and are bare TeX with no delimiters.
 */

const R60 = (60 * Math.PI) / 180;

export type SegColor = "blue" | "red" | "amber";
export type Pair = readonly [string, string];
export type Seg = readonly [string, string, SegColor];
export type Tri = readonly [string, string, string];

/**
 * A surface the statement itself names — the floor a diagonal leans on, the
 * plane that does the cutting, the two faces of a fold. Drawn before any work
 * begins, because the reader was given it rather than having to build it.
 *
 * Three or four points; the scene fan-triangulates, so a triangular face needs
 * no special case.
 */
export type Face = {
  quad: () => readonly Pt[];
  /** Semantic, not a hex literal — see the colour note at the top of scene.ts. */
  col: SegColor;
  /** Fill opacity. Defaults to 0.11, the value the legacy figures used. */
  op?: number;
};

export type AskOption = { v: string; ok?: boolean; why: string };

export type Step = {
  tool: string;
  /** Step heading. */
  t: string;
  /** Body prose, shown once any question on the step is answered. */
  p: string;
  tex?: string;
  note?: string;
  /** Triangle pulled out flat beside the prose. */
  board?: Tri | null;
  /** Segments drawn onto the figure when this step is revealed. */
  add?: readonly Seg[];
  /** Lengths that become known at this step. */
  lens?: readonly Pair[];
  /** Short summary of what the step won. */
  got: string;
  /** Asked before the prose is shown — "ask before tell". */
  ask?: { q: string; opts: readonly AskOption[] };
  /**
   * Where the camera stands while this step is showing. Left off almost
   * everywhere: the scene works it out from the plane the step's own segments
   * and board triangle lie in, which is what "the best view of this step" means
   * in every ordinary case. Set it where the step is about something the
   * geometry does not mention — a stated angle, say, which reads at its true
   * size from one place and nowhere else.
   */
  view?: View;
};

export type Problem = {
  id: string;
  no: string;
  tab: string;
  statement: string;
  given: readonly string[];
  ask: string;
  /** Lengths the statement states outright. */
  known: readonly Pair[];
  incomplete: string;
  pts: () => Points;
  wire: readonly Pair[];
  target: Pair;
  /**
   * What the problem is actually after, when that is not the length of
   * `target`. The section problem asks for an area: the figure still marks a
   * segment in red, but the Ledger must not print that segment's length as if
   * it were the answer.
   */
  targetRow?: { label: string; value: string };
  tools: readonly string[];
  steps: readonly Step[];
  answer: string;
  options: readonly { v: string; ok?: boolean; why?: string }[];
  why: string;
  /** Surfaces the statement names, drawn from step 0. */
  faces?: readonly Face[];
  /**
   * Points the statement hands you outright. Everything else is born at the
   * step that builds it; without this a cuboid's far corners would never
   * appear, since no step ever mentions them.
   */
  atStart?: readonly string[];
  /** Where the camera stands when the problem opens. Defaults to -58 / 20. */
  view?: View;
  /** The tilted plane in 14.57, revealed at the step where it starts to matter. */
  plane?: {
    at: number;
    quad: () => readonly (readonly [number, number, number])[];
    /** The edge the two planes turn about, if the stated angle is worth marking. */
    hinge?: Pair;
    /** A letter, drawn on an arc where the planes meet. */
    angle?: { label: string };
  };
};

export const BOX_PROBLEMS: readonly Problem[] = [
  /* ----------------------------------------------------------------
     The two cuboid problems. They share one solid, and the second
     re-asks the first one's flat sub-problem (AC = 10) on purpose:
     the point of the pair is that a box keeps asking the same small
     question.
     ---------------------------------------------------------------- */
  {
    id: "pcub1",
    no: "C1",
    tab: "Diagonal and the floor",
    statement:
      "A cuboid $ABCDA_1B_1C_1D_1$ has $AB=6$, $BC=8$ and $AA_1=12$. " +
      "Find the angle between the space diagonal $AC_1$ and the base plane $ABCD$.",
    given: ["$AB=6$", "$BC=8$", "$AA_1=12$"],
    ask: "the angle $AC_1$ makes with the base",
    known: [["A", "B"], ["B", "C"], ["A", "A1"]],
    atStart: ["A", "B", "C", "D", "A1", "B1", "C1", "D1"],
    incomplete:
      "The box is drawn, but <b>the triangle you need is not</b>. " +
      "An angle only becomes findable once it sits inside a right triangle — so your first job is to build one.",
    pts: () => ({
      A: [0, 0, 0], B: [6, 0, 0], C: [6, 8, 0], D: [0, 8, 0],
      A1: [0, 0, 12], B1: [6, 0, 12], C1: [6, 8, 12], D1: [0, 8, 12],
    }),
    wire: [
      ["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"],
      ["A1", "B1"], ["B1", "C1"], ["C1", "D1"], ["D1", "A1"],
      ["A", "A1"], ["B", "B1"], ["C", "C1"], ["D", "D1"],
    ],
    target: ["A", "C1"],
    targetRow: { label: "tan α", value: "6/5" },
    // The base plane ABCD, named in the statement.
    faces: [{ quad: () => [[0, 0, 0], [6, 0, 0], [6, 8, 0], [0, 8, 0]], col: "blue", op: 0.1 }],
    tools: ["Line ⊥ plane", "Pythagoras", "Tangent"],
    steps: [
      {
        tool: "Line ⊥ plane",
        t: "Drop it onto the floor",
        ask: {
          q: "To measure how a line leans on a plane, you compare it with…",
          opts: [
            { v: "its shadow on that plane", ok: true, why: "Yes. Shine a light straight down: where the diagonal lands is what the angle is measured against." },
            { v: "the nearest edge of the box", why: "An edge is convenient but arbitrary. The angle with a plane always means the angle with the projection." },
            { v: "the vertical height", why: "That is the side opposite the angle, not the one it is measured from." },
          ],
        },
        p: "The shadow of $AC_1$ on the base is <b>AC</b>. Together with the upright $CC_1$ that gives " +
          "<b>triangle ACC₁</b>, right-angled at C because $CC_1$ stands square on the base.",
        board: ["A", "C", "C1"],
        add: [["A", "C", "amber"]],
        // No `lens` yet: step 2 asks the reader what AC is, so printing 10 on
        // the figure here would answer its own question.
        got: "△ACC₁ is right-angled",
      },
      {
        tool: "Pythagoras",
        t: "Measure the shadow",
        ask: {
          q: "$ABCD$ is a rectangle with sides 6 and 8. So $AC$ is…",
          opts: [
            { v: "$10$", ok: true, why: "Yes — $\\sqrt{36+64}=\\sqrt{100}=10$." },
            { v: "$14$", why: "That is $6+8$. Pythagoras squares the sides first, then adds." },
            { v: "$\\sqrt{28}$", why: "That is $64-36$. The two short sides add, they do not subtract." },
            { v: "$48$", why: "That is $6\\times 8$ — the area of the floor, not its diagonal." },
          ],
        },
        p: "Forget the box for a moment. This is a flat rectangle with a diagonal across it.",
        tex: "AC=\\sqrt{6^2+8^2}=\\sqrt{100}=10",
        board: ["A", "B", "C"],
        add: [["A", "C", "blue"]],
        lens: [["A", "C"]],
        got: "AC = 10",
      },
      {
        tool: "Tangent",
        t: "Now the angle",
        ask: {
          q: "Opposite $\\alpha$ sits 12, beside it sits 10. So $\\tan\\alpha$ is…",
          opts: [
            { v: "$\\tfrac{12}{10}=\\tfrac65$", ok: true, why: "Yes. Tangent is the side facing the angle over the side beside it." },
            { v: "$\\tfrac{10}{12}=\\tfrac56$", why: "Upside down. 10 lies beside the angle, so it belongs underneath." },
            { v: "$\\tfrac{12}{\\sqrt{244}}$", why: "That is $\\sin\\alpha$ — you divided by the long side instead of the near one." },
            { v: "$\\tfrac{10}{\\sqrt{244}}$", why: "That is $\\cos\\alpha$, the same slip the other way round." },
          ],
        },
        p: "α sits between the diagonal and its shadow, in the right triangle you built.",
        tex: "\\tan\\alpha=\\frac{CC_1}{AC}=\\frac{12}{10}=\\frac{6}{5}",
        note: "In degrees that is about $50.2^\\circ$, but $\\tfrac65$ is the exact answer.",
        board: ["A", "C", "C1"],
        add: [["A", "C1", "red"], ["C", "C1", "amber"]],
        // The diagonal's own length, √244, is never worked out and is not what
        // was asked — labelling it as the target would say otherwise.
        got: "tan α = 6/5",
      },
    ],
    answer: "\\tan\\alpha=\\tfrac{6}{5}",
    options: [
      { v: "\\tan\\alpha=\\tfrac65", ok: true },
      { v: "\\tan\\alpha=\\tfrac56", why: "Flipped. The 12 stands opposite the angle, so it goes on top." },
      { v: "\\tan\\alpha=\\tfrac{12}{6}=2", why: "That uses an edge instead of the shadow. The diagonal leans on AC, not on AB." },
      { v: "\\tan\\alpha=\\tfrac{12}{8}=\\tfrac32", why: "Also an edge rather than the shadow — this time BC." },
    ],
    why: "Three small things: find a right triangle, use Pythagoras, use the tangent. Not one of them was about 3D.",
  },
  {
    id: "pcub2",
    no: "C2",
    tab: "Section of a cuboid",
    statement:
      "The same cuboid has $AB=6$, $BC=8$ and $AA_1=12$. " +
      "The plane through $A$, $C$, $C_1$, $A_1$ cuts it. Find the area of the section.",
    given: ["$AB=6$", "$BC=8$", "$AA_1=12$"],
    ask: "the area of the section $ACC_1A_1$",
    known: [["A", "B"], ["B", "C"], ["A", "A1"]],
    atStart: ["A", "B", "C", "D", "A1", "B1", "C1", "D1"],
    incomplete:
      "The four corners of the cut are given, but <b>what shape they make is for you to say</b> — " +
      "and until you know that, no area formula applies.",
    pts: () => ({
      A: [0, 0, 0], B: [6, 0, 0], C: [6, 8, 0], D: [0, 8, 0],
      A1: [0, 0, 12], B1: [6, 0, 12], C1: [6, 8, 12], D1: [0, 8, 12],
    }),
    wire: [
      ["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"],
      ["A1", "B1"], ["B1", "C1"], ["C1", "D1"], ["D1", "A1"],
      ["A", "A1"], ["B", "B1"], ["C", "C1"], ["D", "D1"],
    ],
    // The figure marks the section's diagonal, but the question is an area, so
    // the Ledger prints the area instead of that segment's length.
    target: ["A", "C1"],
    targetRow: { label: "S", value: "120" },
    // The plane through A, C, C1, A1.
    faces: [{ quad: () => [[0, 0, 0], [6, 8, 0], [6, 8, 12], [0, 0, 12]], col: "red", op: 0.16 }],
    tools: ["Naming the shape", "Pythagoras"],
    steps: [
      {
        tool: "Naming the shape",
        t: "What did we cut?",
        ask: {
          q: "The four corners $A,\\;C,\\;C_1,\\;A_1$ make…",
          opts: [
            { v: "a rectangle", ok: true, why: "Yes. $AA_1$ and $CC_1$ are both upright and both 12, and $AA_1$ stands square on the base — so every corner is a right angle." },
            { v: "a parallelogram, but not a rectangle", why: "The opposite sides do match. But the uprights also stand <b>square</b> on the base, which makes the corners right angles too." },
            { v: "a trapezium", why: "A trapezium has one pair of parallel sides. Here both pairs are parallel: the two uprights, and $AC$ with $A_1C_1$." },
          ],
        },
        p: "$AA_1$ and $CC_1$ are parallel and equal, and each stands square on the base. " +
          "So the cut is a <b>rectangle</b>, and all we need is length × width.",
        board: null,
        add: [["A", "C", "amber"], ["C", "C1", "amber"], ["C1", "A1", "amber"], ["A1", "A", "amber"]],
        got: "the section is a rectangle",
      },
      {
        tool: "Pythagoras",
        t: "The side we are missing",
        ask: {
          q: "One side is $AA_1=12$. The other is $AC$, flat on the floor. It is…",
          opts: [
            { v: "$10$", ok: true, why: "Yes — $\\sqrt{36+64}=10$. The very same flat problem as before." },
            { v: "$14$", why: "That is $6+8$. Square the sides first, then add." },
            { v: "$\\sqrt{28}$", why: "That is $64-36$ — subtraction instead of addition." },
            { v: "$48$", why: "That is $6\\times 8$, the area of the floor rather than its diagonal." },
          ],
        },
        p: "$AC$ lies flat on the base, across the rectangle $ABCD$. Ordinary plane geometry.",
        tex: "AC=\\sqrt{6^2+8^2}=10",
        board: ["A", "B", "C"],
        add: [["A", "C", "blue"]],
        lens: [["A", "C"]],
        got: "AC = 10",
      },
      {
        tool: "Naming the shape",
        t: "Multiply",
        p: "A rectangle 10 by 12. Nothing left to work out.",
        tex: "S=AC\\cdot AA_1=10\\cdot 12=120",
        board: null,
        // No `lens` here on purpose: the length this step wins is an area, and
        // `lens` can only speak about the distance between two points.
        add: [],
        got: "S = 120",
      },
    ],
    answer: "S = 120",
    options: [
      { v: "120", ok: true },
      { v: "44", why: "That is the perimeter, $2(10+12)$. The question asks for area." },
      { v: "60", why: "That is half of it — the area of a triangle. The section is a whole rectangle." },
      { v: "576", why: "That is $6\\times 8\\times 12$, the volume of the cuboid, not the area of the cut." },
    ],
    why: "Name the shape, find the side you are missing, multiply. And $AC=10$ was the same small problem as last time — cuboids keep asking it.",
  },
  {
    id: "p1451",
    no: "14.51",
    tab: "Point to a line",
    statement:
      "In right triangle $ABC$ the legs are $AC=15$ and $BC=20$, with the right angle at $C$. " +
      "A perpendicular $CM=5$ is erected to the plane of the triangle at $C$. " +
      "Find the distance from $M$ to the hypotenuse $AB$.",
    given: ["$AC=15$", "$BC=20$", "$\\angle C=90^\\circ$", "$CM=5$", "$CM\\perp$ plane $ABC$"],
    ask: "distance from M to AB",
    known: [["A", "C"], ["B", "C"], ["C", "M"]],
    incomplete:
      "The figure shows only what the statement gives you: the triangle, and CM standing on it. " +
      "<b>The line you actually need is not drawn yet</b> — nothing here touches AB at a right angle. You will add it.",
    pts: () => ({ A: [15, 0, 0], B: [0, 20, 0], C: [0, 0, 0], H: [9.6, 7.2, 0], M: [0, 0, 5] }),
    wire: [["A", "B"], ["B", "C"], ["C", "A"], ["C", "M"]],
    target: ["M", "H"],
    // Low enough that the 5-unit upright reads at its full length.
    view: { theta: -62, phi: 11 },
    tools: ["Pythagoras", "Area, two ways", "Line ⊥ plane"],
    steps: [
      {
        tool: "Pythagoras",
        t: "Get the hypotenuse",
        p: "Start flat. <b>ABC</b> is right-angled at C, and you know both legs.",
        tex: "AB=\\sqrt{15^2+20^2}=25",
        board: ["A", "C", "B"],
        add: [["A", "B", "blue"]],
        lens: [["A", "B"]],
        got: "AB = 25",
      },
      {
        tool: "Area, two ways",
        t: "Drop the height onto AB",
        ask: {
          q: "You want CH, the height onto AB. Which of these already contains CH?",
          opts: [
            { v: "The area of ABC", ok: true, why: "Yes. The area does not care which side you call the base — so writing it twice pins CH down." },
            { v: "Triangle MCH", why: "It does contain CH — but to use it you would need MH, and MH is exactly what we are hunting. Something else has to give CH first." },
            { v: "The hypotenuse AB", why: "AB is just a length. On its own it says nothing about how far C sits from it." },
          ],
        },
        p: "Call <b>H</b> the foot of the perpendicular from C to AB. The area of the triangle can be written two ways — and only one of them contains CH.",
        tex: "\\tfrac12\\cdot 15\\cdot 20=\\tfrac12\\cdot 25\\cdot CH\\;\\Rightarrow\\;CH=\\frac{300}{25}=12",
        board: ["A", "C", "B"],
        add: [["C", "H", "blue"]],
        lens: [["C", "H"]],
        got: "CH = 12",
      },
      {
        tool: "Line ⊥ plane",
        t: "The right angle you cannot see",
        ask: {
          q: "Why is MH the distance from M to AB, rather than just some segment?",
          opts: [
            { v: "Because MH ⊥ AB", ok: true, why: "Right. Distance to a line always means the perpendicular — and we can prove this one is perpendicular without seeing it." },
            { v: "Because MH is the shortest we can draw", why: "True, but that is the consequence, not the reason. You need an argument that it is perpendicular." },
            { v: "Because H is the midpoint of AB", why: "H is not the midpoint — it is the foot of the perpendicular from C. Different point." },
          ],
        },
        p: "CM is perpendicular to the whole plane, so it is perpendicular to <b>every</b> line in it — AB included. CH is perpendicular to AB too. So AB is perpendicular to the plane MCH, which makes <b>MH ⊥ AB</b>.",
        note: "That is exactly what &ldquo;distance from M to AB&rdquo; means: the perpendicular.",
        board: null,
        add: [["M", "H", "red"], ["M", "C", "amber"]],
        got: "MH ⊥ AB",
      },
      {
        tool: "Pythagoras",
        t: "Finish in the hidden triangle",
        p: "Triangle <b>MCH</b> is right-angled at C. Both legs are known.",
        tex: "MH^2=5^2+12^2=169",
        board: ["M", "C", "H"],
        add: [],
        lens: [["M", "H"]],
        got: "MH = 13",
      },
    ],
    answer: "MH = 13",
    options: [
      { v: "13", ok: true },
      { v: "\\sqrt{194}\\approx 13.9", why: "That is √(5²+13²) — looks like CH got mixed up with the hypotenuse AB. The height onto AB is 12, not 13." },
      { v: "12", why: "That is CH, the distance from <b>C</b> to AB. M sits 5 above C, so it must be further away than that." },
      { v: "5", why: "That is CM — how far M is from the <b>plane</b>. The question asks for its distance to a particular line in that plane." },
    ],
    why: "Notice what happened: two flat steps, then one idea about space, then one more flat step. None of it was hard on its own.",
  },
  {
    id: "p1457",
    no: "14.57",
    tab: "Point to a plane",
    statement:
      "In triangle $ABC$, $AB=29$, $BC=36$ and $AC=25$. A plane is drawn through $BC$, " +
      "making an angle $\\alpha$ with the plane of the triangle, where $\\sin\\alpha=\\tfrac{2}{5}$. " +
      "Find the distance from $A$ to that plane.",
    given: ["$AB=29$", "$BC=36$", "$AC=25$", "$\\sin\\alpha=\\tfrac{2}{5}$"],
    ask: "distance from A to the plane",
    known: [["A", "B"], ["B", "C"], ["A", "C"]],
    incomplete:
      "The triangle and the tilted plane are both here, as stated. " +
      "<b>The height onto BC and the perpendicular from A are not</b> — you add those.",
    pts: () => {
      const sa = 2 / 5, ca = Math.sqrt(1 - sa * sa);
      // Foot of the perpendicular from A onto the plane through BC tilted by α.
      return {
        A: [21, 20, 0], B: [0, 0, 0], C: [36, 0, 0], H: [21, 0, 0],
        F: [21, 20 - 20 * sa * sa, 20 * sa * ca],
      };
    },
    wire: [["A", "B"], ["B", "C"], ["C", "A"]],
    target: ["A", "F"],
    // Where the stated angle actually reads at its true size.
    view: { theta: -118, phi: 17 },
    plane: {
      // The statement gives you this plane, so it is there from the start.
      at: 0,
      quad: () => {
        // Hinged on BC itself, opening by the stated angle: sin α = 2/5.
        const sa = 2 / 5, ca = Math.sqrt(1 - sa * sa), L = 26;
        return [[0, 0, 0], [36, 0, 0], [36, L * ca, L * sa], [0, L * ca, L * sa]];
      },
      hinge: ["B", "C"],
      angle: { label: "α" },
    },
    tools: ["Heron", "Area, two ways", "Angle between planes"],
    steps: [
      {
        tool: "Heron",
        t: "Area from three sides",
        p: "No angles given, no height given — but three sides is enough.",
        tex: "p=\\tfrac{29+36+25}{2}=45,\\quad S=\\sqrt{45\\cdot16\\cdot9\\cdot20}=360",
        board: ["A", "B", "C"],
        add: [],
        got: "S = 360",
      },
      {
        tool: "Area, two ways",
        t: "Turn the area into a height",
        ask: {
          q: "You have the area. Which height does it hand you for free?",
          opts: [
            { v: "The one onto BC", ok: true, why: "Yes — BC is the side the tilted plane hinges on, so that is the height that matters." },
            { v: "The one onto AB", why: "You could find it, but it would not help: AB is not the hinge between the two planes." },
            { v: "None — you need an angle first", why: "The area already contains every height. Pick a side as the base and the height follows." },
          ],
        },
        p: "Let <b>H</b> be the foot of the perpendicular from A to BC. Write the same area the other way.",
        tex: "360=\\tfrac12\\cdot 36\\cdot AH\\;\\Rightarrow\\;AH=20",
        board: ["A", "B", "C"],
        add: [["A", "H", "blue"]],
        lens: [["A", "H"]],
        got: "AH = 20",
      },
      {
        tool: "Angle between planes",
        t: "Tilt it into the new plane",
        p: "AH is perpendicular to BC, and BC is the hinge between the two planes. So AH sits exactly in the plane where the angle α lives — and the distance you want is the part of AH that stands off the tilted plane.",
        tex: "d=AH\\sin\\alpha=20\\cdot\\tfrac{2}{5}=8",
        // The segment AF is not what this step is about — the fold α is, and it
        // only reads at its true size from where the problem opens. Aiming at
        // AF would turn away from the one thing the step is explaining.
        view: { theta: -118, phi: 17 },
        board: null,
        add: [["A", "F", "red"]],
        lens: [["A", "F"]],
        got: "d = 8",
      },
    ],
    answer: "d = 8",
    options: [
      { v: "8", ok: true },
      { v: "20", why: "That is AH, the distance from A to <b>BC</b> inside the original plane. The new plane is tilted away from it." },
      { v: "20\\cos\\alpha\\approx 18.3", why: "Close — but cosine gives the part of AH lying <b>along</b> the tilted plane. You want the part standing off it, which is sine." },
      { v: "360", why: "That is the area of the triangle — an intermediate value, not the distance." },
    ],
    why: "The only spatial idea here was the last line. Everything before it was plane geometry you have done since school.",
  },
  {
    id: "p1458",
    no: "14.58",
    tab: "Two folded triangles",
    statement:
      "Two isosceles triangles share the common base $AB=16$, and their planes form an angle of $60^\\circ$. " +
      "The first has equal sides $17$ and $17$. In the second, the two equal sides are perpendicular to each other. " +
      "Find the distance between their apexes.",
    given: ["$AB=16$", "$PA=PB=17$", "$QA\\perp QB$", "planes at $60^\\circ$"],
    ask: "PQ",
    known: [["A", "B"], ["P", "A"], ["P", "B"]],
    incomplete:
      "Both triangles and both planes are here, as stated. " +
      "<b>Nothing connects P to Q yet</b>, and neither height is drawn. " +
      "Those three lines are the whole solution.",
    pts: () => ({
      A: [-8, 0, 0], B: [8, 0, 0], M: [0, 0, 0],
      P: [0, 15, 0], Q: [0, 8 * Math.cos(R60), 8 * Math.sin(R60)],
    }),
    wire: [["A", "B"], ["A", "P"], ["B", "P"], ["A", "Q"], ["B", "Q"]],
    target: ["P", "Q"],
    atStart: ["A", "B", "P", "Q"],
    // The two triangles the statement folds together.
    faces: [
      { quad: () => [[-8, 0, 0], [8, 0, 0], [0, 15, 0]], col: "blue", op: 0.1 },
      {
        quad: () => [[-8, 0, 0], [8, 0, 0], [0, 8 * Math.cos(R60), 8 * Math.sin(R60)]],
        col: "red", op: 0.1,
      },
    ],
    tools: ["Pythagoras", "Right isosceles", "Angle between planes", "Law of cosines"],
    steps: [
      {
        tool: "Pythagoras",
        t: "Height of the first triangle",
        p: "<b>M</b> is the midpoint of AB, so AM = 8. The first triangle is isosceles, so PM is its height.",
        tex: "PM^2=17^2-8^2=225\\;\\Rightarrow\\;PM=15",
        board: ["A", "P", "M"],
        add: [["P", "M", "blue"]],
        lens: [["P", "M"]],
        got: "PM = 15",
      },
      {
        tool: "Right isosceles",
        t: "Height of the second",
        p: "QA and QB are equal <b>and</b> perpendicular, so AQB is a right isosceles triangle with hypotenuse AB. In one of those, the median to the hypotenuse is half of it.",
        tex: "QM=\\tfrac12 AB=8",
        board: ["A", "Q", "M"],
        add: [["Q", "M", "blue"]],
        lens: [["Q", "M"]],
        got: "QM = 8",
      },
      {
        tool: "Angle between planes",
        t: "Where the 60° actually sits",
        ask: {
          q: "The planes meet at 60°. Between which two lines is that angle actually measured?",
          opts: [
            { v: "PM and QM", ok: true, why: "Yes. Both are perpendicular to the hinge AB, and that is exactly the definition." },
            { v: "PA and QA", why: "Neither is perpendicular to AB, so the angle between them is not the angle between the planes." },
            { v: "PQ and AB", why: "PQ is what we are looking for — it cannot be part of what we were given." },
          ],
        },
        p: "PM and QM are <b>both</b> perpendicular to AB, and AB is the hinge. That is the definition of the angle between the planes — so the angle at M, between PM and QM, is the 60° you were given.",
        note: "This is the step people skip. The 60° is not between any two random lines: it is between these two.",
        board: null,
        add: [],
        got: "∠PMQ = 60°",
      },
      {
        tool: "Law of cosines",
        t: "Two sides and the angle between them",
        p: "Triangle <b>PMQ</b> now has everything it needs.",
        tex: "PQ^2=15^2+8^2-2\\cdot15\\cdot8\\cos 60^\\circ=169",
        board: ["P", "M", "Q"],
        add: [["P", "Q", "red"]],
        lens: [["P", "Q"]],
        got: "PQ = 13",
      },
    ],
    answer: "PQ = 13",
    options: [
      { v: "13", ok: true },
      { v: "17", why: "That is PA, one of the equal sides of the first triangle — not the gap between the two apexes." },
      { v: "\\sqrt{409}\\approx 20.2", why: "Every piece is there, but the cosine term looks <b>added</b> rather than subtracted — that would be a 120° fold, not 60°." },
      { v: "23", why: "That is 15 + 8, the two heights added. They do not lie on one straight line — there is 60° between them." },
    ],
    why: "Three of the four steps were plane geometry. The whole spatial part was realising which angle the 60° belonged to.",
  },
  {
    id: "p1459",
    no: "14.59",
    tab: "Across a fold",
    statement:
      "From points $A$ and $B$ lying on the two faces of a dihedral angle, perpendiculars " +
      "$AA_1$ and $BB_1$ are dropped to its edge. Find $AB$, given $AA_1=a$, $BB_1=b$, " +
      "$A_1B_1=c$ and the dihedral angle $x$.",
    given: ["$AA_1=3$", "$BB_1=4$", "$A_1B_1=5$", "$x=60^\\circ$"],
    ask: "AB",
    known: [["A", "A1"], ["B", "B1"], ["A1", "B1"]],
    incomplete:
      "Everything the statement mentions is drawn — and it is not enough. " +
      "<b>The fold angle is not between anything yet</b>, because the two perpendiculars start in different places.",
    pts: () => ({
      A1: [0, 0, 0], B1: [5, 0, 0], A: [0, 3, 0],
      B: [5, 4 * Math.cos(R60), 4 * Math.sin(R60)], A2: [5, 3, 0],
    }),
    wire: [["A", "A1"], ["B", "B1"], ["A1", "B1"]],
    target: ["A", "B"],
    atStart: ["A", "A1", "B", "B1"],
    // The two faces of the dihedral angle.
    faces: [
      { quad: () => [[-2, 0, 0], [7, 0, 0], [7, 5, 0], [-2, 5, 0]], col: "blue", op: 0.1 },
      {
        quad: () => {
          const c = Math.cos(R60), sn = Math.sin(R60);
          return [[-2, 0, 0], [7, 0, 0], [7, 5 * c, 5 * sn], [-2, 5 * c, 5 * sn]];
        },
        col: "red", op: 0.1,
      },
    ],
    tools: ["Parallel translation", "Law of cosines", "Line ⊥ plane", "Pythagoras"],
    steps: [
      {
        tool: "Parallel translation",
        t: "Bring the two perpendiculars together",
        p: "The dihedral angle sits between two perpendiculars that meet the edge at the <b>same</b> point. Yours meet it in different places. Slide AA₁ along the edge until its foot lands on B₁.",
        tex: "A_2B_1=AA_1=3,\\qquad AA_2=A_1B_1=5",
        board: null,
        add: [["A", "A2", "amber"], ["A2", "B1", "blue"]],
        lens: [["A", "A2"], ["A2", "B1"]],
        got: "the point A₂",
      },
      {
        tool: "Law of cosines",
        t: "A flat triangle you can already solve",
        ask: {
          q: "In triangle A₂B₁B you know two sides. What is the angle between them?",
          opts: [
            { v: "The fold angle, 60°", ok: true, why: "Yes — both of those sides are perpendicular to the edge, which is what the fold angle is measured between." },
            { v: "90°", why: "That would make it a right fold. The problem says 60°." },
            { v: "Not enough information", why: "You have it — sliding AA₁ across is exactly what put the fold angle between two sides you know." },
          ],
        },
        p: "In triangle <b>A₂B₁B</b> you know two sides, and the angle between them is the fold angle itself — because both of those segments are perpendicular to the edge.",
        tex: "A_2B^2=3^2+4^2-2\\cdot3\\cdot4\\cos60^\\circ=13",
        board: ["A2", "B1", "B"],
        add: [["A2", "B", "blue"]],
        lens: [["A2", "B"]],
        got: "A₂B = √13",
      },
      {
        tool: "Line ⊥ plane",
        t: "The corner at A₂ is square",
        p: "AA₂ runs parallel to the edge, and the edge is perpendicular to both B₁A₂ and B₁B. Perpendicular to two intersecting lines means perpendicular to the whole plane — so the angle at A₂ is 90°.",
        note: "Spin the figure: it never looks square from any angle. Trust the rule, not the picture.",
        board: null,
        add: [],
        got: "∠AA₂B = 90°",
      },
      {
        tool: "Pythagoras",
        t: "Stand it up",
        p: "One leg runs along the edge, the other lies in the fold.",
        tex: "AB^2=5^2+13=38",
        board: ["A", "A2", "B"],
        add: [["A", "B", "red"]],
        lens: [["A", "B"]],
        got: "AB = √38",
      },
    ],
    answer: "AB = \\sqrt{38}",
    options: [
      { v: "\\sqrt{38}", ok: true },
      { v: "\\sqrt{50}", why: "That is a²+b²+c² — what you get when the cosine term vanishes, which only happens at a right fold. This one is 60°." },
      { v: "\\sqrt{62}", why: "Every piece is there, but the cosine term looks added rather than subtracted. Worth checking the sign." },
      { v: "\\sqrt{13}", why: "That is A₂B, the flat triangle inside the fold — and that part is right. There is one more step: standing it up along the edge." },
    ],
    why: "In general this is AB = √(a²+b²+c²−2ab cos x). Fold to 90° and the cosine term vanishes — it becomes the diagonal of a box.",
  },
];

/**
 * The pyramid's problems.
 *
 * Empty until they are written — the problem stage renders an explicit
 * "nothing here yet" state for an empty set rather than crashing on
 * PROBLEMS[0], so the topic stays navigable while this fills up.
 */
export const PYRAMID_PROBLEMS: readonly Problem[] = [];

const TOPIC_PROBLEMS: Readonly<Record<string, readonly Problem[]>> = {
  box: BOX_PROBLEMS,
  pyramid: PYRAMID_PROBLEMS,
};

/**
 * The problem set for one topic. An unknown slug gets an empty set, which the
 * stage renders as "not written yet" — the honest answer for a topic nobody
 * has authored problems for.
 */
export function getProblems(topicSlug: string): readonly Problem[] {
  return TOPIC_PROBLEMS[topicSlug] ?? [];
}
