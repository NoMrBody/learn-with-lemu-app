import * as THREE from "three";
import { figColor, onFigureTheme } from "@/lib/figure-theme";

/**
 * The axioms explainer's 3D world, ported from legacy/axioms.html.
 *
 * Same contract as lib/explainer/scene.ts: framework-agnostic, owns its own
 * canvas, rAF loop and DOM label overlay, and React pushes plain data in
 * through `update()`. The geometry maths is the original's, typed —
 * `planeOf`, `meetLine` and `clipToRect` are carried over unchanged, including
 * the 0.85 shortest-height threshold that decides a triple is too close to a
 * straight line to trust.
 *
 * Unlike the box/pyramid scene, which builds every mesh once and mutates it
 * for the whole lesson, this one has a different figure per beat with almost
 * nothing in common between them. So it rebuilds on a `figure` change and
 * mutates only within a figure — which is also why the theme listener here
 * replays the builder rather than hunting for materials to recolour.
 *
 * Nothing here sets a position the reader can see change. Input and figures
 * write to `want`; the loop eases what is drawn toward it, per second rather
 * than per frame, so the same easing catches a flicked drag, a scroll wheel,
 * a change of beat and the slider. A piece that appears fades or grows in on
 * a one-shot tween. Both collapse to the end state when the reader has asked
 * for reduced motion.
 */

/* ============================================================
   vectors
   ============================================================ */

export type Vec = readonly [number, number, number];

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec, s: number): Vec => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

type Plane = { n: Vec; p: Vec; h: number; collinear: boolean };

/**
 * The plane through three points, and whether they are too close to one
 * straight line to define it. `h` is the triangle's shortest height: as the
 * points line up it goes to zero, which is a scale-aware test where comparing
 * the cross product's length is not.
 */
function planeOf(A: Vec, B: Vec, C: Vec): Plane {
  const n = cross(sub(B, A), sub(C, A));
  const area = len(n) / 2;
  const scale = Math.max(len(sub(B, A)), len(sub(C, A)), len(sub(C, B)));
  const h = scale > 0 ? (2 * area) / scale : 0;
  return { n: norm(n), p: A, h, collinear: h < 0.85 };
}

type Line = { p: Vec; dir: Vec };

/** The common line of two planes, or null when they are parallel. */
function meetLine(n1: Vec, d1: number, n2: Vec, d2: number): Line | null {
  const dir = cross(n1, n2);
  if (len(dir) < 1e-9) return null;
  const D = len(dir) ** 2;
  const p = add(mul(cross(n2, dir), d1), mul(cross(dir, n1), d2));
  return { p: mul(p, 1 / D), dir: norm(dir) };
}

/**
 * Clip an infinite line to a rectangle given as centre + two in-plane axes +
 * half sizes. Returns the two endpoints, or null when the line misses it.
 */
function clipToRect(
  line: Line, C: Vec, u: Vec, v: Vec, a: number, b: number,
): [Vec, Vec] | null {
  let t0 = -1e9, t1 = 1e9;
  for (const [ax, half] of [[u, a], [v, b]] as const) {
    const den = dot(line.dir, ax);
    const s = dot(sub(line.p, C), ax);
    if (Math.abs(den) < 1e-9) {
      // Parallel to this pair of edges: either wholly inside them or wholly out.
      if (Math.abs(s) > half) return null;
      continue;
    }
    let lo = (-half - s) / den, hi = (half - s) / den;
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    t0 = Math.max(t0, lo);
    t1 = Math.min(t1, hi);
  }
  if (t1 <= t0) return null;
  return [add(line.p, mul(line.dir, t0)), add(line.p, mul(line.dir, t1))];
}

/* ============================================================
   what a beat asks the scene to show
   ============================================================ */

/**
 * One figure per screen of the original. 'none' is the two screens that hid
 * the stage entirely — the opening and the ruler-on-a-table aside.
 */
export type AxiomFigure =
  | "none"
  | "plane3pts"
  | "pick3"
  | "planeFlat"
  | "lineInPlane"
  | "pick2OnPlane"
  | "twoPlanes"
  | "planeSlide"
  | "corner"
  | "toolkit";

export type AxiomsParams = {
  figure: AxiomFigure;
  /** 0 = β lifted clear of α, 1 = β pushed through it. Only "planeSlide" reads it. */
  slide: number;
  /**
   * Bumped by the panel's "Try again" button. Any change clears the points
   * the learner placed and starts the figure over.
   */
  resetKey: number;
};

/** What the panel needs to know about an interactive figure's progress. */
export type PickState = {
  /** Points placed so far. */
  count: number;
  /** Enough points, but too close to one straight line to fix a plane. */
  collinear: boolean;
  /** The two planes are touching, so their common line exists. */
  meeting: boolean;
};

export type AxiomsScene = {
  update: (p: AxiomsParams) => void;
  /** Stops the auto-spin — called on first user interaction. */
  stopSpin: () => void;
  resize: () => void;
  dispose: () => void;
};

/* ============================================================
   palette

   Semantic colours stay literal, exactly as they do in the box/pyramid
   scene: the blue plane, the red points and the amber warning carry
   meaning that must not drift with the theme. Only the intersection
   line is structural, and it goes through figColor('ink').
   ============================================================ */

const C = {
  planeA: 0x2b4fe8,
  planeB: 0xe8442a,
  point: 0xe8442a,
  warn: 0xe39a22,
} as const;

/** Label colours are DOM, so they can name the tokens and theme for free. */
const LAB = {
  known: "var(--fig-known)",
  target: "var(--fig-target)",
  ink: "var(--fig-ink)",
} as const;

export function createAxiomsScene(
  stage: HTMLElement,
  labelBox: HTMLElement,
  onPick: (s: PickState) => void,
): AxiomsScene {
  // r128 had no colour management; opting out keeps the original palette
  // rendering exactly as it was authored. Same reasoning as scene.ts.
  THREE.ColorManagement.enabled = false;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  stage.insertBefore(renderer.domElement, labelBox);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  camera.up.set(0, 0, 1);
  // Intensities scaled by PI: three dropped legacy light units in r155, and
  // this restores the original brightness under the new convention.
  scene.add(new THREE.AmbientLight(0xffffff, 0.62 * Math.PI));
  const key = new THREE.DirectionalLight(0xffffff, 0.55 * Math.PI);
  key.position.set(6, -9, 12);
  scene.add(key);

  const world = new THREE.Group();
  scene.add(world);

  /* ============================================================
     motion

     Everything that moves reads the same two helpers. `approach` is for a
     value chasing a target — the camera, the sliding plane — and `tween`
     is for the one-shot arrivals a figure fires when a piece appears.
     Both are handed the frame's elapsed seconds rather than counting
     frames, so a 120Hz display moves at the same speed as a 60Hz one
     instead of at twice it.

     A reader who has asked for less motion gets the end state directly:
     every tween lands on 1 and every approach snaps, so the figures still
     say what they say, without the travel.
     ============================================================ */

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = reduceQuery.matches;
  const onReduce = () => { reduced = reduceQuery.matches; };
  reduceQuery.addEventListener("change", onReduce);

  /** Ease `cur` toward `target`. `k` is a rate per second, not per frame. */
  const approach = (cur: number, target: number, k: number, dt: number) =>
    reduced ? target : cur + (target - cur) * (1 - Math.exp(-k * dt));

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const easeOut = (t: number) => 1 - (1 - t) ** 3;
  /** Overshoots a little and settles: a point placed lands rather than blinks. */
  const popIn = (t: number) => {
    const u = t - 1;
    return 1 + 2.2 * u ** 3 + 1.2 * u ** 2;
  };

  /** How long a piece takes to arrive, in ms. */
  const FADE_MS = 420, POP_MS = 340, GROW_MS = 300;

  /** One-shot tweens. They belong to the figure that started them. */
  let anims: ((dt: number) => boolean)[] = [];

  function tween(ms: number, apply: (t: number) => void) {
    if (reduced) { apply(1); return; }
    let t = 0;
    apply(0);
    anims.push((dt) => {
      t = Math.min(1, t + (dt * 1000) / ms);
      apply(t);
      return t >= 1;
    });
  }

  /* ============================================================
     builders
     ============================================================ */

  function dotAt(g: THREE.Group, p: Vec, colour: number, r = 0.22, appear = false) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 18, 14),
      new THREE.MeshBasicMaterial({ color: colour }),
    );
    m.position.set(p[0], p[1], p[2]);
    // Points read as points even where a plane passes in front of them.
    m.material.depthTest = false;
    m.renderOrder = 12;
    g.add(m);
    // A point the learner just placed grows into position, so the eye is
    // carried to it instead of having to find what changed.
    if (appear) tween(POP_MS, (t) => m.scale.setScalar(Math.max(0.001, popIn(t))));
    return m;
  }

  function segment(
    g: THREE.Group, a: Vec, b: Vec, colour: number, rad = 0.055, onTop = false,
    appear = false,
  ) {
    const A = new THREE.Vector3(a[0], a[1], a[2]);
    const B = new THREE.Vector3(b[0], b[1], b[2]);
    const L = A.distanceTo(B);
    if (L < 1e-6) return null;
    const mat = new THREE.MeshBasicMaterial({ color: colour });
    if (onTop) mat.depthTest = false;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, L, 12), mat);
    if (onTop) m.renderOrder = 11;
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize(),
    );
    g.add(m);
    // The cylinder's axis is its y, so drawing it is a matter of growing
    // that one scale out from the middle.
    if (appear) tween(GROW_MS, (t) => m.scale.setY(Math.max(0.001, easeOut(t))));
    return m;
  }

  function quad(g: THREE.Group, pts: Vec[], colour: number, op: number, appear = false) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3]], 3,
      ),
    );
    geo.computeVertexNormals();
    const face = new THREE.MeshLambertMaterial({
      color: colour, transparent: true, opacity: op, side: THREE.DoubleSide,
    });
    g.add(new THREE.Mesh(geo, face));
    const edges: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < 4; i++) {
      const e = segment(g, pts[i], pts[(i + 1) % 4], colour, 0.035);
      if (e) edges.push(e.material as THREE.MeshBasicMaterial);
    }
    // A plane fades up where it is rather than sliding or scaling in: it is
    // meant to read as having been there all along, once enough is known to
    // draw it. The patch is centred on the figure, so any scale-in would
    // slide it across the world instead.
    if (!appear) return;
    for (const m of edges) m.transparent = true;
    tween(FADE_MS, (t) => {
      const e = easeOut(t);
      face.opacity = op * e;
      for (const m of edges) m.opacity = e;
    });
  }

  type Patch = { u: Vec; v: Vec; c: Vec; s: number; n: Vec };

  /** A plane drawn as a square patch, given a point on it and its normal. */
  function planePatch(
    g: THREE.Group, point: Vec, normal: Vec, size: number, colour: number, op: number,
    appear = false,
  ): Patch {
    const n = norm(normal);
    const u = norm(Math.abs(n[2]) < 0.9 ? cross(n, [0, 0, 1]) : cross(n, [1, 0, 0]));
    const v = norm(cross(n, u));
    const s = size;
    quad(g, [
      add(add(point, mul(u, -s)), mul(v, -s)),
      add(add(point, mul(u, s)), mul(v, -s)),
      add(add(point, mul(u, s)), mul(v, s)),
      add(add(point, mul(u, -s)), mul(v, s)),
    ], colour, op, appear);
    return { u, v, c: point, s, n };
  }

  /* ---- floating labels ---- */

  type Tag = { el: HTMLDivElement; at: () => Vec; born: boolean };
  let tags: Tag[] = [];

  function tag(text: string, at: () => Vec, colour: string) {
    const el = document.createElement("div");
    // Born hidden: the first frame paints it at zero and the second clears
    // the class, so .lab's own opacity transition fades it up. Placing it
    // before the first paint would have it appear at full strength.
    el.className = "lab dim hide";
    el.textContent = text;
    el.style.color = colour;
    // Position is carried entirely by the transform below, so left/top stay
    // at the origin rather than being written every frame.
    el.style.left = "0";
    el.style.top = "0";
    labelBox.appendChild(el);
    tags.push({ el, at, born: false });
    return el;
  }

  const _v = new THREE.Vector3();
  function updateTags() {
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const t of tags) {
      const p = t.at();
      _v.set(p[0], p[1], p[2]).project(camera);
      const behind = _v.z > 1;
      // A transform moves the label on the compositor. Writing left/top
      // instead re-runs layout for every label on every frame, which is the
      // one cost the loop cannot afford while the camera is turning.
      t.el.style.transform =
        `translate3d(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px, 0)`
        + " translate(-50%, -50%)";
      if (!t.born && !behind) { t.born = true; continue; }
      t.el.classList.toggle("hide", behind);
    }
  }

  /* ---- teardown between figures ---- */

  function wipe() {
    for (const child of [...world.children]) {
      world.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
    }
    for (const t of tags) t.el.remove();
    tags = [];
    // The tweens belong to the pieces just disposed of.
    anims = [];
  }

  /* ============================================================
     camera
     ============================================================ */

  /**
   * Where the camera is, and where it is going. Every input — a drag, the
   * wheel, a figure asking to be framed differently — writes to `want`, and
   * the loop eases `cam` toward it. Nothing moves the camera directly, so a
   * jump is not expressible: the same easing catches a flicked drag, a
   * notched scroll wheel and a change of beat.
   */
  const cam = { theta: -58, phi: 22, dist: 26, zoom: 1 };
  const want = { ...cam };

  /** How fast each part of the camera catches up, per second. */
  const K_TURN = 18, K_DIST = 4.5, K_ZOOM = 11;

  let autoSpin = true;
  /** Idle rotation, in degrees per second — the old 0.08 a frame at 60Hz. */
  const SPIN = 4.8;

  /** What is left of a drag once the finger lifts, in degrees per second. */
  let spinVel = 0, tiltVel = 0;
  const K_COAST = 3.4;

  function applyOrbit() {
    const t = (cam.theta * Math.PI) / 180;
    const p = (cam.phi * Math.PI) / 180;
    const d = cam.dist * cam.zoom;
    camera.position.set(
      d * Math.cos(p) * Math.cos(t),
      d * Math.cos(p) * Math.sin(t),
      d * Math.sin(p),
    );
    camera.lookAt(0, 0, 0);
  }

  /** Arrive rather than travel — the first frame has nothing to come from. */
  function snapOrbit() {
    cam.theta = want.theta; cam.phi = want.phi;
    cam.dist = want.dist; cam.zoom = want.zoom;
    spinVel = 0; tiltVel = 0;
    applyOrbit();
  }

  /* ============================================================
     input

     Click and drag share the pointer: a press that moves more than a few
     pixels, or dwells longer than half a second, is an orbit and never
     places a point. Straight from the original.
     ============================================================ */

  const pts = new Map<number, [number, number]>();
  let lx = 0, ly = 0, pd = 0, downAt = 0, dragged = false;
  /** When the last move arrived, so a drag's speed is in seconds, not frames. */
  let lastMoveAt = 0, dragging = false;

  const spread = () => {
    const a = [...pts.values()];
    return Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) || 1;
  };

  const onDown = (e: PointerEvent) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      lx = e.clientX; ly = e.clientY; downAt = Date.now(); dragged = false;
      lastMoveAt = performance.now();
      dragging = true;
      // Taking hold stops whatever the last flick was still doing.
      spinVel = 0; tiltVel = 0;
    } else if (pts.size === 2) pd = spread();
    autoSpin = false;
  };

  const onMove = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      const dx = e.clientX - lx, dy = e.clientY - ly;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
      const dTheta = -dx * 0.4;
      const dPhi = dy * 0.34;
      want.theta += dTheta;
      want.phi = clamp(want.phi + dPhi, -84, 84);

      // Speed is measured against the clock and then blended, so one stray
      // event between frames cannot decide how the flick coasts.
      const now = performance.now();
      const ms = Math.max(8, now - lastMoveAt);
      lastMoveAt = now;
      const inst = 1000 / ms;
      spinVel = clamp(spinVel * 0.6 + dTheta * inst * 0.4, -420, 420);
      tiltVel = clamp(tiltVel * 0.6 + dPhi * inst * 0.4, -420, 420);

      lx = e.clientX; ly = e.clientY;
    } else if (pts.size === 2) {
      const d = spread();
      if (pd) want.zoom = clamp((want.zoom * pd) / d, 0.6, 2.2);
      pd = d;
    }
  };

  const onUp = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    const single = pts.size === 1;
    pts.delete(e.pointerId);
    if (pts.size === 0) dragging = false;
    // A press that never became a drag has no speed to hand on.
    if (!dragged) { spinVel = 0; tiltVel = 0; }
    // A drag that ended stationary should stay where it was let go of.
    if (performance.now() - lastMoveAt > 90) { spinVel = 0; tiltVel = 0; }
    if (single && !dragged && Date.now() - downAt < 500) live.onClick?.(e);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // Scaled by how much the wheel actually reported, so a trackpad's stream
    // of small deltas glides where a notched wheel steps — and neither jumps,
    // because the loop eases toward this rather than adopting it. The unit
    // has to be asked for: Firefox reports lines and Safari pixels for the
    // same gesture, and reading a line count as pixels is no zoom at all.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const notch = clamp((e.deltaY * unit) / 240, -1, 1);
    want.zoom = clamp(want.zoom * Math.exp(notch * 0.18), 0.6, 2.2);
  };

  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);
  stage.addEventListener("wheel", onWheel, { passive: false });

  /* where a screen click lands in the world */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function rayFrom(e: PointerEvent): { o: Vec; d: Vec } {
    const r = stage.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const { origin, direction } = ray.ray;
    return { o: [origin.x, origin.y, origin.z], d: [direction.x, direction.y, direction.z] };
  }

  function hitPlane(e: PointerEvent, point: Vec, normal: Vec): Vec | null {
    const R = rayFrom(e);
    const den = dot(R.d, normal);
    if (Math.abs(den) < 1e-6) return null;
    const t = dot(sub(point, R.o), normal) / den;
    if (t < 0) return null;
    return add(R.o, mul(R.d, t));
  }

  /* ============================================================
     the figures

     `live` is what a figure leaves behind for the rest of the lesson to
     talk to: the click handler while points are still being placed, and
     the slider hook on the one figure that has a slider.
     ============================================================ */

  type Live = {
    onClick?: (e: PointerEvent) => void;
    /** `snap` is the rebuild restoring a slider position, not the reader moving it. */
    onSlide?: (t: number, snap?: boolean) => void;
    /** Called every frame, for a figure with something of its own to ease. */
    onFrame?: (dt: number) => void;
  };
  let live: Live = {};

  const IDLE: PickState = { count: 0, collinear: false, meeting: false };

  const FIGURES: Record<AxiomFigure, () => void> = {
    none() {
      want.dist = 26;
    },

    /* ---------- axiom 1, the statement ---------- */
    plane3pts() {
      const A: Vec = [-4, -2, 0], B: Vec = [3, -3, 1.5], Cp: Vec = [0, 4, -1];
      const pl = planeOf(A, B, Cp);
      planePatch(world, mul(add(add(A, B), Cp), 1 / 3), pl.n, 6.5, C.planeA, 0.2, true);
      ([[A, "A"], [B, "B"], [Cp, "C"]] as const).forEach(([p, nm]) => {
        dotAt(world, p, C.point, 0.24, true);
        tag(nm, () => add(p, [0, 0, 0.9]), LAB.target);
      });
      want.dist = 24;
    },

    /* ---------- axiom 1, place them yourself ---------- */
    pick3() {
      const placed: Vec[] = [];
      // Each click redraws the figure from scratch, so this remembers how
      // much of it the learner has already seen: the points already down
      // stay where they are while the new one lands.
      let shown = 0;
      want.dist = 30;

      const draw = () => {
        wipe();
        const from = shown;
        shown = placed.length;
        const fresh = placed.length > from;
        placed.forEach((p, i) => {
          dotAt(world, p, C.point, 0.24, i >= from);
          tag("ABC"[i], () => add(p, [0, 0, 0.9]), LAB.target);
        });
        if (placed.length < 3) {
          onPick({ count: placed.length, collinear: false, meeting: false });
          return;
        }
        const pl = planeOf(placed[0], placed[1], placed[2]);
        if (pl.collinear) {
          // No plane is drawn: three points on a line lie on infinitely many,
          // so drawing one would be the opposite of the lesson.
          for (let i = 0; i < 2; i++) {
            segment(world, placed[i], placed[i + 1], C.warn, 0.05, true, fresh);
          }
          onPick({ count: 3, collinear: true, meeting: false });
          return;
        }
        const centre = mul(add(add(placed[0], placed[1]), placed[2]), 1 / 3);
        planePatch(world, centre, pl.n, 7, C.planeA, 0.22, fresh);
        for (let i = 0; i < 3; i++) {
          segment(world, placed[i], placed[(i + 1) % 3], C.point, 0.045, true, fresh);
        }
        onPick({ count: 3, collinear: false, meeting: false });
      };

      live.onClick = (e) => {
        if (placed.length >= 3) return;
        const R = rayFrom(e);
        // A click names a direction, not a point, so the depth is chosen for
        // the learner — far enough out that the three rarely line up.
        placed.push(add(R.o, mul(R.d, 10 + Math.random() * 14)));
        draw();
      };

      onPick(IDLE);
    },

    /* ---------- axiom 1, why three ---------- */
    planeFlat() {
      planePatch(world, [0, 0, 0], [0, 0, 1], 6, C.planeA, 0.18, true);
      ([[-3.5, -2, 0], [3, -2.5, 0], [0.5, 3.5, 0]] as Vec[]).forEach((p) =>
        dotAt(world, p, C.point, 0.22, true),
      );
      want.dist = 22;
      want.phi = 26;
    },

    /* ---------- axiom 2, the statement ---------- */
    lineInPlane() {
      planePatch(world, [0, 0, 0], [0, 0, 1], 7, C.planeA, 0.2, true);
      const A: Vec = [-3, -1.4, 0], B: Vec = [2.6, 1.8, 0];
      const d = norm(sub(B, A));
      segment(world, add(A, mul(d, -4)), add(B, mul(d, 4)), C.point, 0.055, true, true);
      ([[A, "A"], [B, "B"]] as const).forEach(([p, nm]) => {
        dotAt(world, p, C.point, 0.24, true);
        tag(nm, () => add(p, [0, 0, 0.8]), LAB.target);
      });
      tag("α", () => [5.4, -5.4, 0], LAB.known);
      want.dist = 24;
    },

    /* ---------- axiom 2, place them yourself ---------- */
    pick2OnPlane() {
      const N = norm([0.18, -0.1, 1]);
      const P0: Vec = [0, 0, 0];
      const S = 7;
      const placed: Vec[] = [];
      // As in pick3: the plane arrives once, and each point only lands once.
      let shown = 0, firstDraw = true;
      want.dist = 26;

      const draw = () => {
        wipe();
        const from = shown;
        shown = placed.length;
        const pl = planePatch(world, P0, N, S, C.planeA, 0.2, firstDraw);
        firstDraw = false;
        tag("α", () => add(add(P0, mul(pl.u, S * 0.78)), mul(pl.v, -S * 0.78)), LAB.known);
        placed.forEach((p, i) => {
          dotAt(world, p, C.point, 0.24, i >= from);
          tag("AB"[i], () => add(p, [0, 0, 0.8]), LAB.target);
        });
        if (placed.length === 2) {
          const line = { p: placed[0], dir: norm(sub(placed[1], placed[0])) };
          const seg = clipToRect(line, P0, pl.u, pl.v, S, S);
          if (seg) segment(world, seg[0], seg[1], C.point, 0.055, true, from < 2);
        }
        onPick({ count: placed.length, collinear: false, meeting: false });
      };

      live.onClick = (e) => {
        if (placed.length >= 2) return;
        const hit = hitPlane(e, P0, N);
        if (!hit) return;
        // Only clicks that land on the patch itself count — off the edge, the
        // point would not be "a point of the plane" the axiom is about.
        const u = norm(Math.abs(N[2]) < 0.9 ? cross(N, [0, 0, 1]) : cross(N, [1, 0, 0]));
        const v = norm(cross(N, u));
        const off = sub(hit, P0);
        if (Math.abs(dot(off, u)) > S || Math.abs(dot(off, v)) > S) return;
        placed.push(hit);
        draw();
      };

      draw();
    },

    /* ---------- axiom 3, the statement ---------- */
    twoPlanes() {
      const nA: Vec = [0, 0, 1], nB = norm([0.75, 0, 0.66]);
      planePatch(world, [0, 0, 0], nA, 6, C.planeA, 0.18, true);
      planePatch(world, [0, 0, 0], nB, 6, C.planeB, 0.16, true);
      const L = meetLine(nA, 0, nB, 0);
      if (L) {
        segment(world, add(L.p, mul(L.dir, -6)), add(L.p, mul(L.dir, 6)), figColor("ink"), 0.06, true, true);
        tag("l", () => add(L.p, mul(L.dir, 6.6)), LAB.ink);
      }
      want.dist = 24;
    },

    /* ---------- axiom 3, bring the planes together ---------- */
    planeSlide() {
      const nA: Vec = [0, 0, 1];
      const tilt = (52 * Math.PI) / 180;
      const nB = norm([Math.sin(tilt), 0, Math.cos(tilt)]);
      const S = 6.5, HIGH = 9;
      // Where β is, and where the slider has asked it to be. The reader
      // drags a continuous control but can also step it with the arrow keys
      // or click the track, and those arrive as jumps — so the plane always
      // travels to the reading rather than adopting it.
      let height = HIGH, wantHeight = HIGH;
      let meeting: [Vec, Vec] | null = null;
      // The common line fades rather than blinking, and keeps its last
      // placement while it goes, so parting the planes is not a hard cut.
      let lineOp = 0;
      // Only told to the panel when the answer changes, not every frame.
      let reported: boolean | null = null;

      // Built once: the slider moves things, it never rebuilds them.
      const pa = planePatch(world, [0, 0, 0], nA, S, C.planeA, 0.17, true);
      const betaG = new THREE.Group();
      world.add(betaG);
      const pb = planePatch(betaG, [0, 0, 0], nB, S, C.planeB, 0.15, true);

      const lineMat = new THREE.MeshBasicMaterial({ color: figColor("ink") });
      lineMat.depthTest = false;
      lineMat.transparent = true;
      lineMat.opacity = 0;
      const lineMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 1, 12), lineMat,
      );
      lineMesh.renderOrder = 11;
      lineMesh.visible = false;
      world.add(lineMesh);

      tag("α", () => add(mul(pa.u, S * 0.8), mul(pa.v, -S * 0.8)), LAB.known);
      tag("β", () => add([0, 0, height], add(mul(pb.u, S * 0.8), mul(pb.v, S * 0.8))), LAB.target);
      const lTag = tag(
        "l",
        () => (meeting ? add(mul(add(meeting[0], meeting[1]), 0.5), [0, 0, 0.8]) : [0, 0, -999]),
        LAB.ink,
      );

      const move = () => {
        betaG.position.set(0, 0, height);
        const L = meetLine(nA, 0, nB, dot(nB, [0, 0, height]));
        meeting = null;
        if (L) {
          const s1 = clipToRect(L, [0, 0, 0], pa.u, pa.v, S, S);
          const s2 = clipToRect(L, [0, 0, height], pb.u, pb.v, S, S);
          if (s1 && s2) {
            // The visible common line is where both square patches overlap,
            // not where the infinite planes would meet.
            const at = (q: Vec) => dot(sub(q, L.p), L.dir);
            const lo = Math.max(Math.min(at(s1[0]), at(s1[1])), Math.min(at(s2[0]), at(s2[1])));
            const hi = Math.min(Math.max(at(s1[0]), at(s1[1])), Math.max(at(s2[0]), at(s2[1])));
            if (hi > lo + 1e-6) {
              meeting = [add(L.p, mul(L.dir, lo)), add(L.p, mul(L.dir, hi))];
            }
          }
        }
        if (meeting) {
          const A = new THREE.Vector3(...meeting[0]);
          const B = new THREE.Vector3(...meeting[1]);
          lineMesh.scale.set(1, A.distanceTo(B), 1);
          lineMesh.position.copy(A).add(B).multiplyScalar(0.5);
          lineMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize(),
          );
        }
        // Visibility is the fade's business, not this function's.
        lTag.classList.toggle("hide", !meeting);
        const now = meeting !== null;
        if (now !== reported) {
          reported = now;
          onPick({ count: 0, collinear: false, meeting: now });
        }
      };

      live.onSlide = (t, snap) => {
        wantHeight = HIGH - t * HIGH;
        if (!snap) return;
        // A rebuild restoring the slider's position has nowhere to travel from.
        height = wantHeight;
        lineOp = 0;
        move();
      };

      live.onFrame = (dt) => {
        const h = approach(height, wantHeight, 14, dt);
        if (Math.abs(h - height) > 1e-4) {
          height = Math.abs(h - wantHeight) < 1e-3 ? wantHeight : h;
          move();
        }
        const target = meeting ? 1 : 0;
        lineOp = approach(lineOp, target, 12, dt);
        if (Math.abs(lineOp - target) < 0.01) lineOp = target;
        lineMat.opacity = lineOp;
        lineMesh.visible = lineOp > 0.01;
      };

      move();
      want.dist = 27;
      want.phi = 16;
    },

    /* ---------- axiom 3, two walls of a room ---------- */
    corner() {
      planePatch(world, [0, 0, 0], [1, 0, 0], 5, C.planeA, 0.17, true);
      planePatch(world, [0, 0, 0], [0, 1, 0], 5, C.planeB, 0.15, true);
      segment(world, [0, 0, -5], [0, 0, 5], figColor("ink"), 0.07, true, true);
      tag("l", () => [0, 0, 5.6], LAB.ink);
      want.dist = 22;
      want.phi = 8;
    },

    /* ---------- the toolkit ---------- */
    toolkit() {
      const nA: Vec = [0, 0, 1], nB = norm([0.6, 0.2, 0.8]);
      planePatch(world, [0, 0, 0], nA, 5.5, C.planeA, 0.15, true);
      planePatch(world, [0, 0, 0], nB, 5.5, C.planeB, 0.13, true);
      const L = meetLine(nA, 0, nB, 0);
      if (L) {
        segment(world, add(L.p, mul(L.dir, -5.5)), add(L.p, mul(L.dir, 5.5)), figColor("ink"), 0.055, true, true);
      }
      ([[-3, -2, 0], [2.6, -2.4, 0], [0.4, 3.2, 0]] as Vec[]).forEach((p) =>
        dotAt(world, p, C.point, 0.2, true),
      );
      want.dist = 24;
    },
  };

  /* ============================================================
     the loop
     ============================================================ */

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  let raf = 0, lastFrame = 0;
  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    // Seconds since the last frame, clamped so a tab returning from the
    // background does not resume with one enormous step.
    const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 1 / 60;
    lastFrame = now;

    if (autoSpin && !reduced) want.theta -= SPIN * dt;

    // What is left of a flick, spent down over about a second.
    if (!dragging && !reduced && (spinVel || tiltVel)) {
      want.theta += spinVel * dt;
      want.phi = clamp(want.phi + tiltVel * dt, -84, 84);
      const decay = Math.exp(-K_COAST * dt);
      spinVel *= decay;
      tiltVel *= decay;
      if (Math.abs(spinVel) < 1.5) spinVel = 0;
      if (Math.abs(tiltVel) < 1.5) tiltVel = 0;
    }

    cam.theta = approach(cam.theta, want.theta, K_TURN, dt);
    cam.phi = approach(cam.phi, want.phi, K_TURN, dt);
    cam.dist = approach(cam.dist, want.dist, K_DIST, dt);
    cam.zoom = approach(cam.zoom, want.zoom, K_ZOOM, dt);
    applyOrbit();

    if (anims.length) anims = anims.filter((a) => !a(dt));
    live.onFrame?.(dt);

    renderer.render(scene, camera);
    updateTags();
  }

  /* ============================================================
     update
     ============================================================ */

  let current: AxiomFigure | null = null;
  let currentReset = -1;
  let slide = 0;

  /** The first figure is arrived at rather than travelled to. */
  let started = false;

  function build(figure: AxiomFigure) {
    wipe();
    live = {};
    // A figure asks to be framed; it does not set the camera. Whatever it
    // asks for here, the loop eases into over the next half second, so
    // turning a page moves the view instead of cutting it.
    want.phi = 22;
    want.zoom = 1;
    autoSpin = true;
    onPick(IDLE);
    FIGURES[figure]();
    // A figure with a slider is rebuilt at whatever the slider already reads,
    // so paging away and back does not silently lift β again — and with no
    // travel, because there is no previous position to have come from.
    live.onSlide?.(slide, true);
    resize();
    if (!started) { started = true; snapOrbit(); }
  }

  function update(p: AxiomsParams) {
    slide = p.slide;
    if (p.figure !== current || p.resetKey !== currentReset) {
      current = p.figure;
      currentReset = p.resetKey;
      build(p.figure);
      return;
    }
    live.onSlide?.(p.slide);
  }

  resize();
  snapOrbit();
  tick(performance.now());

  // Only the intersection line is structural, and it is baked into a material
  // at build time, so replaying the current figure is both the simplest and
  // the cheapest way to pick up a theme change.
  const stopTheme = onFigureTheme(() => {
    if (current) build(current);
  });

  return {
    update,
    stopSpin: () => { autoSpin = false; },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      stopTheme();
      reduceQuery.removeEventListener("change", onReduce);
      window.removeEventListener("resize", resize);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("wheel", onWheel);
      wipe();
      renderer.dispose();
      renderer.domElement.remove();
      labelBox.replaceChildren();
    },
  };
}
