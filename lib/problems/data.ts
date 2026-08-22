import type { Points } from "./geometry";

/**
 * The four problems, ported from the PROBLEMS array in legacy/problems.html.
 *
 * Prose keeps the original `$…$` maths and `<b>` emphasis as authored, so it
 * still diffs cleanly against the legacy file; lib/problems/rich.tsx turns
 * that into React nodes at render time.
 */

const R60 = (60 * Math.PI) / 180;

export type SegColor = "blue" | "red" | "amber";
export type Pair = readonly [string, string];
export type Seg = readonly [string, string, SegColor];
export type Tri = readonly [string, string, string];

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
  tools: readonly string[];
  steps: readonly Step[];
  answer: string;
  options: readonly { v: string; ok?: boolean; why?: string }[];
  why: string;
  /** The tilted plane in 14.57, revealed at the step where it starts to matter. */
  plane?: { at: number; quad: () => readonly (readonly [number, number, number])[] };
};

export const PROBLEMS: readonly Problem[] = [
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
      "Only the triangle is given. <b>The tilted plane and the height onto BC are both missing</b> — " +
      "you draw them once you know where they go.",
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
    plane: {
      at: 2,
      quad: () => {
        const sa = 2 / 5, ca = Math.sqrt(1 - sa * sa), L = 19;
        return [[8, 0, 0], [34, 0, 0], [34, L * ca, L * sa], [8, L * ca, L * sa]];
      },
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
      "Both triangles are here, but <b>nothing connects P to Q yet</b>, and neither height is drawn. " +
      "Those three lines are the whole solution.",
    pts: () => ({
      A: [-8, 0, 0], B: [8, 0, 0], M: [0, 0, 0],
      P: [0, 15, 0], Q: [0, 8 * Math.cos(R60), 8 * Math.sin(R60)],
    }),
    wire: [["A", "B"], ["A", "P"], ["B", "P"], ["A", "Q"], ["B", "Q"]],
    target: ["P", "Q"],
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
