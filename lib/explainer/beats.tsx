import type { ReactNode } from "react";
import type {
  Dims, FaceKind, PyrAngKind, PyrFaceKind, PyrTriKind, SceneGroups, SceneLabels,
  Solid,
} from "./scene";

/**
 * The beats of the stereometry explainers, ported from the BEATS array in
 * legacy/topic.html (which reworked legacy/cuboid.html).
 *
 * The box and the pyramid are separate topics, each with its own explainer,
 * but they are the same nine slides seen from two sides — so this stays one
 * array and `getBeats(topicSlug)` cuts it down per topic. A `solids` mode says
 * which topics a beat belongs to:
 *   'both' — both topics; pinned to whichever solid the topic is about
 *   'box'  — the box explainer only
 *   'pyr'  — the pyramid explainer only
 *   'none' — neither solid is drawn (the two abstract plane beats), both topics
 *
 * There is no toggle any more: `getBeats` resolves 'both' down to one solid on
 * the way out, so nothing downstream ever sees it.
 *
 * Where a slide's wording only makes sense for one solid, `titleBySolid` /
 * `bodyBySolid` / `knowBySolid` override it. The original kept a single
 * wording per slide, which left the volume and scaling slides talking about
 * boxes while showing a pyramid.
 */

export type ControlKind =
  | "dims" | "none" | "unfoldSum" | "fill" | "double" | "diag"
  | "faces" | "pyrTri" | "pyrAng" | "cri" | "angDist" | "prj"
  // Retained for the beats that were cut (parallel translation, three
  // perpendiculars, the plain angle panel). No beat references them; their
  // scene groups are still built, so restoring a slide is a one-line change.
  | "par" | "tpp" | "solo";

/**
 * Which explainer(s) a beat appears in. 'both' never survives getBeats() — it
 * is resolved to the topic's own solid there.
 */
export type SolidMode = "both" | "box" | "pyr" | "none";

/** Everything the learner can change that outlives a single beat. */
export type UserState = {
  solid: Solid;
  dims: Dims;
  unfold: number;
  fill: number;
  doubled: boolean;
  faceKind: FaceKind;
  pyrFaceKind: PyrFaceKind;
  pyrTri: PyrTriKind;
  pyrAng: PyrAngKind;
  tppTheta: number;
  soloH: number;
  parT: number;
  criAng: number;
};

export const INITIAL_USER_STATE: UserState = {
  solid: "box",
  dims: { L: 6, W: 4, H: 3 },
  unfold: 0,
  fill: 0,
  doubled: false,
  faceKind: "base",
  pyrFaceKind: "base",
  pyrTri: "apo",
  pyrAng: "face",
  tppTheta: 90,
  soloH: 4,
  parT: 0,
  criAng: 25,
};

export type Beat = {
  title: string;
  body: string;
  know?: { t: string; p: ReactNode };
  control: ControlKind;
  solids: SolidMode;
  glass: number;
  groups?: Partial<SceneGroups>;
  labels?: Partial<SceneLabels>;
  /** Face areas appear only once the net is open enough to read them. */
  areasWhenFlat?: boolean;
  showArc?: boolean;
  showMarkBase?: boolean;
  showPrjArc?: boolean;
  /** Applied on entry, mirroring the original's per-beat resets. */
  onEnter?: Partial<UserState>;
  titleBySolid?: Partial<Record<Solid, string>>;
  bodyBySolid?: Partial<Record<Solid, string>>;
  knowBySolid?: Partial<Record<Solid, { t: string; p: ReactNode }>>;
};

export const BEAT_GROUPS: SceneGroups = {
  solidVisible: true, third: false, ptri: false, pang: false, diag: false,
  tri: false, highlight: false, tpp: false, prj: false, solo: false,
  par: false, cri: false, doubled: false,
};

export const BEAT_LABELS: SceneLabels = {
  dims: false, areas: false, diag: [], tpp: false, solo: false,
};

/** Resolves a beat's wording for the solid currently on screen. */
export function beatText(b: Beat, solid: Solid) {
  return {
    title: b.titleBySolid?.[solid] ?? b.title,
    body: b.bodyBySolid?.[solid] ?? b.body,
    know: b.knowBySolid?.[solid] ?? b.know,
  };
}

export const BEATS: Beat[] = [
  {
    // Wording only: with the topics split there is no toggle here any more, so
    // the shared text would be promising a choice the page cannot offer.
    title: "Three numbers, and they are yours.",
    body: "Pick them now. Whatever you choose stays with you for the whole page — every face, every net, every diagonal from here on is yours, not ours.",
    titleBySolid: {
      box: "Three numbers, one box.",
      pyr: "Three numbers, one pyramid.",
    },
    bodyBySolid: {
      box: "Length, width and height — that is the whole description. Whatever you choose stays with you for the whole page: every face, every net, every diagonal from here on is yours, not ours.",
      pyr: "A rectangular base, and an apex directly above its centre. The same three numbers describe all of it. Whatever you choose stays with you for the whole page: every face, every net, every slant from here on is yours, not ours.",
    },
    know: {
      t: "Worth trying",
      p: (
        <>
          Come back to this slider at any point — nothing on this page is locked to one
          set of numbers.
        </>
      ),
    },
    knowBySolid: {
      box: {
        t: "Worth trying",
        p: (
          <>
            Set all three equal and you have a <b>cube</b>. Come back to this slider at
            any point — nothing on this page is locked to one set of numbers.
          </>
        ),
      },
      pyr: {
        t: "Worth trying",
        p: (
          <>
            Make the base square for a <b>right square pyramid</b>, then flatten the
            height right down and watch the slant faces fall towards the base. Come back
            to this slider at any point — nothing on this page is locked to one set of
            numbers.
          </>
        ),
      },
    },
    control: "dims",
    solids: "both",
    glass: 0.4,
    labels: { dims: true },
    onEnter: { unfold: 0, fill: 0, doubled: false },
  },
  {
    title: "Open it up — that is the surface area.",
    body: "Drag the slider. Nothing stretches: the same six faces lie flat, each one just a side times a side. Add them.",
    bodyBySolid: {
      pyr: "Drag the slider. The pyramid opens into a base and four triangles. Each triangle's height is its apothem — the slant, not the edge to the apex.",
    },
    know: {
      t: "Use this in exercises",
      p: (
        <>
          Most 3D questions get finished in 2D — you pull out a flat piece, do the
          arithmetic there, then put the answer back. And count the faces the question
          actually has: <b>no lid means five</b>, painting a room leaves out the floor.
        </>
      ),
    },
    knowBySolid: {
      pyr: {
        t: "Use this in exercises",
        p: (
          <>
            The classic slip is using the <b>lateral edge</b> where the{" "}
            <b>apothem</b> belongs. The triangle&apos;s height runs to the midpoint of a base
            edge, not to a corner. And <b>lateral area</b> means the four triangles only
            — add the base yourself if the question wants the total.
          </>
        ),
      },
    },
    control: "unfoldSum",
    solids: "both",
    glass: 0,
    areasWhenFlat: true,
    onEnter: { fill: 0 },
  },
  {
    title: "Volume is just counting.",
    titleBySolid: { pyr: "Volume is a third of the box." },
    body: "Pour in cubes of side 1. One layer, then how many layers.",
    bodyBySolid: {
      pyr: "No counting this time. Draw the box that contains the pyramid — same base, same height. Three of this pyramid fill it exactly.",
    },
    know: {
      t: "Use this in exercises",
      p: (
        <>
          A cubic centimetre <b>is</b> one of these cubes. When a question gives you the
          volume and two edges, you are being asked to undo this counting.
        </>
      ),
    },
    knowBySolid: {
      pyr: {
        t: "Use this in exercises",
        p: (
          <>
            The <b>⅓</b> is not a fudge factor — three pyramids with the same base and
            height fill the prism exactly. Height means the <b>perpendicular</b> from the
            apex to the base, never a slant edge, which is where most marks are lost.
          </>
        ),
      },
    },
    control: "fill",
    solids: "both",
    glass: 1,
    onEnter: { unfold: 0 },
  },
  {
    title: "Double every edge.",
    body: "Twice as long each way. Eight of the old box fit inside the new one.",
    bodyBySolid: {
      pyr: "Twice as long each way. The outline is the same pyramid with every edge doubled — eight of the original fit inside it.",
    },
    know: {
      t: "Use this in exercises",
      p: (
        <>
          Area has two directions, volume has three. Scale by <b>k</b> and they grow by{" "}
          <b>k²</b> and <b>k³</b>. Twice as big is four times the paper and eight times
          the contents.
        </>
      ),
    },
    control: "double",
    solids: "both",
    glass: 0,
    onEnter: { unfold: 0, fill: 0, doubled: false },
  },
  {
    // The pyramid's answer to the box's Pythagoras slide, and the piece the
    // split port left behind: TRIANGLES_PYR in legacy/topic-cuboid.html.
    title: "The three hidden right triangles.",
    body: "Every question about this pyramid comes down to one of these three. All of them share the height — what changes is the second leg. Tap each one.",
    know: {
      t: "Use this in exercises",
      p: (
        <>
          <b>h, w/2, apothem</b> gives the apothem, which the surface area needs.{" "}
          <b>h, R, lateral edge</b> gives the lateral edge — its foot is a corner, so
          the second leg is the half-diagonal, not w/2. <b>apothem, l/2, lateral edge</b>{" "}
          sits inside one face and ties the other two together, which is why the same
          edge comes out of both. Reaching for the wrong second leg is the single most
          common mistake in this topic.
        </>
      ),
    },
    control: "pyrTri",
    solids: "pyr",
    // Glass is transparency, not opacity: these triangles run through the
    // inside, so they need the same see-through the box's diagonal beat uses.
    glass: 0.85,
    groups: { ptri: true },
    labels: { dims: true },
    onEnter: { unfold: 0, fill: 0, doubled: false, solid: "pyr", pyrTri: "apo" },
  },
  {
    title: "You will need Pythagoras. A lot.",
    body: "Questions ask for corner-to-opposite-corner. That line is not an edge and it is not drawn — you build it, from a right triangle that sits on no face. Green flat on the base, then gold standing up on green.",
    know: {
      t: "Use this in exercises",
      p: (
        <>
          This is the move nearly every hard 3D problem needs:{" "}
          <b>find the right triangle hiding inside the solid.</b> One step flat, one step
          standing up — two ordinary Pythagoras calculations, chained. Careful: green
          stays on a face, gold goes through the middle. If the two corners share a face,
          it is green.
        </>
      ),
    },
    control: "diag",
    solids: "box",
    glass: 0.85,
    groups: { diag: true, tri: true },
    labels: { dims: true, diag: ["face", "space", "vert"] },
    showArc: false,
    showMarkBase: false,
    onEnter: { unfold: 0, fill: 0, doubled: false, solid: "box" },
  },
  {
    title: "Faces problems ask about.",
    body: "Tap each one to see which part of the box it means, and how its area is worked out.",
    bodyBySolid: {
      pyr: "Tap each one to see which part of the pyramid it means, and how its area is worked out. Two of them are cuts through the inside, not faces.",
    },
    know: {
      t: "Use this in exercises",
      p: (
        <>
          Read the wording carefully. <b>Lateral</b> means walls only. <b>Total</b> means
          everything. A <b>section</b> is a cut through the inside, not a face — and its
          sides are usually diagonals, so find those first.
        </>
      ),
    },
    knowBySolid: {
      pyr: {
        t: "Use this in exercises",
        p: (
          <>
            Read the wording carefully. <b>Lateral</b> means the four triangles only.{" "}
            <b>Total</b> adds the base. The last two chips are <b>sections</b> — cuts
            through the inside, not faces — and both of them contain the height. That is
            exactly what makes them the two worth taking: a cut with h in it turns a
            question about space into a question about a triangle.
          </>
        ),
      },
    },
    control: "faces",
    solids: "both",
    glass: 0.8,
    groups: { highlight: true },
    labels: { dims: true },
    onEnter: {
      unfold: 0, fill: 0, doubled: false, faceKind: "base", pyrFaceKind: "base",
    },
  },
  {
    // ANGLES_PYR in legacy/topic-cuboid.html. Concrete first: the abstract
    // angle-to-a-plane slide two on from here generalises what this shows.
    title: "How steep is it?",
    body: "A face leans on the base, and so does an edge. Same height both times — only the foot moves, and that alone makes them different angles.",
    know: {
      t: "Use this in exercises",
      p: (
        <>
          A <b>lateral face</b> uses h and w/2. A <b>lateral edge</b> uses h and the
          half-diagonal R. Since w/2 &lt; R, the face angle is always the steeper of the
          two — a free check on an answer. Why the angle is measured against the shadow
          rather than against a convenient edge is coming up.
        </>
      ),
    },
    control: "pyrAng",
    solids: "pyr",
    // The axis and the shadow both cross the interior — further open still.
    glass: 0.9,
    groups: { pang: true },
    onEnter: { unfold: 0, fill: 0, doubled: false, solid: "pyr", pyrAng: "face" },
  },
  {
    title: "Two lines are enough.",
    body: "A plane holds infinitely many lines, so proving a line is perpendicular to all of them sounds hopeless. It is not. Get it square to just two that cross, and every other line in the plane follows. Turn the gold one and watch the right angle survive.",
    know: {
      t: "Use this in exercises",
      p: (
        <>
          <b>Perpendicular to two intersecting lines of a plane means perpendicular to
          the plane.</b> Two checks, not infinitely many — that is why this is the
          workhorse for proving heights are really heights. Everything else on this page
          about perpendicularity rests on it.
        </>
      ),
    },
    control: "cri",
    solids: "none",
    glass: 0,
    groups: { cri: true },
    onEnter: { unfold: 0, fill: 0, doubled: false, criAng: 25 },
  },
  {
    title: "Angles and distances, on one picture.",
    body: "A is above the plane; H is straight below it; M is any point in the plane. AM slants, HM is its shadow. Every angle and every distance you will be asked for lives in this one triangle. Raise A and watch them move together.",
    know: {
      t: "Use this in exercises",
      p: (
        <>
          The <b>angle</b> a line makes with a plane is the angle with its shadow — never
          with a convenient edge, so <b>tan α = AH / HM</b>. The <b>distance</b> to a
          plane is the perpendicular AH; the <b>distance</b> to a line is the
          perpendicular onto that line. When a question says “distance” it is asking you
          to find, or prove, a right angle.
        </>
      ),
    },
    control: "angDist",
    solids: "none",
    glass: 0,
    groups: { solo: true },
    labels: { solo: true },
    onEnter: { unfold: 0, fill: 0, doubled: false },
  },
  {
    title: "One plane, and its shadow on another.",
    body: "The tilted cut and the base below it are the same shape seen at an angle. Shrink the tilted one onto the base and you get the shadow — smaller by exactly the cosine of the angle between the two planes.",
    know: {
      t: "Use this in exercises",
      p: (
        <>
          To <b>build</b> the angle: pick any point on the shared edge and go
          perpendicular to the edge inside each plane — that pair is the angle, and
          picking directions that are not perpendicular to the edge is the classic way to
          get it wrong. To <b>skip building it</b>: <b>S′ = S·cos φ</b>, where S′ is the
          shadow. Know any two of the three and the third is free.
        </>
      ),
    },
    control: "prj",
    solids: "box",
    glass: 1,
    groups: { prj: true },
    labels: { dims: true },
    showPrjArc: false,
    onEnter: { unfold: 0, fill: 0, doubled: false, solid: "box" },
  },
];

/* ============================================================
   per-topic selection

   The box and the pyramid are separate topics over one array of
   beats. Everything below turns "which topic" into "which beats,
   showing which solid".
   ============================================================ */

/** The solid each stereometry topic is about. */
const TOPIC_SOLID: Readonly<Record<string, Solid>> = {
  box: "box",
  pyramid: "pyr",
};

/**
 * The solid a topic's explainer shows. Unknown slugs fall back to the box:
 * a topic that reaches this without an entry is a wiring mistake, and showing
 * the box is a better failure than showing nothing.
 */
export function solidFor(topicSlug: string): Solid {
  return TOPIC_SOLID[topicSlug] ?? "box";
}

/** The starting state for a topic, with its solid already pinned. */
export function initialUserState(topicSlug: string): UserState {
  return { ...INITIAL_USER_STATE, solid: solidFor(topicSlug) };
}

/**
 * The beats for one topic's explainer.
 *
 * Two things happen here. Beats belonging to the other solid are dropped —
 * the box keeps the Pythagoras and projection slides, which have no pyramid
 * reading. And 'both' is resolved to this topic's solid, so no beat downstream
 * still claims to offer a choice: `Controls` renders the solid toggle exactly
 * when it sees 'both', and with the topics split there is nothing to toggle.
 */
export function getBeats(topicSlug: string): Beat[] {
  const solid = solidFor(topicSlug);
  return BEATS.filter(
    (b) => b.solids === "both" || b.solids === "none" || b.solids === solid,
  ).map((b) => (b.solids === "both" ? { ...b, solids: solid } : b));
}
