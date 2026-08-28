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
     builders
     ============================================================ */

  function dotAt(g: THREE.Group, p: Vec, colour: number, r = 0.22) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(r, 18, 14),
      new THREE.MeshBasicMaterial({ color: colour }),
    );
    m.position.set(p[0], p[1], p[2]);
    // Points read as points even where a plane passes in front of them.
    m.material.depthTest = false;
    m.renderOrder = 12;
    g.add(m);
    return m;
  }

  function segment(
    g: THREE.Group, a: Vec, b: Vec, colour: number, rad = 0.055, onTop = false,
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
    return m;
  }

  function quad(g: THREE.Group, pts: Vec[], colour: number, op: number) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3]], 3,
      ),
    );
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: colour, transparent: true, opacity: op, side: THREE.DoubleSide,
    })));
    for (let i = 0; i < 4; i++) segment(g, pts[i], pts[(i + 1) % 4], colour, 0.035);
  }

  type Patch = { u: Vec; v: Vec; c: Vec; s: number; n: Vec };

  /** A plane drawn as a square patch, given a point on it and its normal. */
  function planePatch(
    g: THREE.Group, point: Vec, normal: Vec, size: number, colour: number, op: number,
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
    ], colour, op);
    return { u, v, c: point, s, n };
  }

  /* ---- floating labels ---- */

  type Tag = { el: HTMLDivElement; at: () => Vec };
  let tags: Tag[] = [];

  function tag(text: string, at: () => Vec, colour: string) {
    const el = document.createElement("div");
    el.className = "lab dim";
    el.textContent = text;
    el.style.color = colour;
    labelBox.appendChild(el);
    tags.push({ el, at });
    return el;
  }

  const _v = new THREE.Vector3();
  function updateTags() {
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const t of tags) {
      const p = t.at();
      _v.set(p[0], p[1], p[2]).project(camera);
      t.el.style.left = `${(_v.x * 0.5 + 0.5) * w}px`;
      t.el.style.top = `${(-_v.y * 0.5 + 0.5) * h}px`;
      t.el.classList.toggle("hide", _v.z > 1);
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
  }

  /* ============================================================
     camera
     ============================================================ */

  const orbit = { theta: -58, phi: 22, dist: 26 };
  let autoSpin = true, zoomMul = 1;

  function applyOrbit() {
    const t = (orbit.theta * Math.PI) / 180;
    const p = (orbit.phi * Math.PI) / 180;
    const d = orbit.dist * zoomMul;
    camera.position.set(
      d * Math.cos(p) * Math.cos(t),
      d * Math.cos(p) * Math.sin(t),
      d * Math.sin(p),
    );
    camera.lookAt(0, 0, 0);
  }

  /* ============================================================
     input

     Click and drag share the pointer: a press that moves more than a few
     pixels, or dwells longer than half a second, is an orbit and never
     places a point. Straight from the original.
     ============================================================ */

  const pts = new Map<number, [number, number]>();
  let lx = 0, ly = 0, pd = 0, downAt = 0, dragged = false;

  const spread = () => {
    const a = [...pts.values()];
    return Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) || 1;
  };

  const onDown = (e: PointerEvent) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      lx = e.clientX; ly = e.clientY; downAt = Date.now(); dragged = false;
    } else if (pts.size === 2) pd = spread();
    autoSpin = false;
  };

  const onMove = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      const dx = e.clientX - lx, dy = e.clientY - ly;
      if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
      orbit.theta -= dx * 0.4;
      orbit.phi = Math.max(-84, Math.min(84, orbit.phi + dy * 0.34));
      lx = e.clientX; ly = e.clientY;
    } else if (pts.size === 2) {
      const d = spread();
      if (pd) zoomMul = Math.max(0.6, Math.min(2.2, (zoomMul * pd) / d));
      pd = d;
    }
  };

  const onUp = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    const single = pts.size === 1;
    pts.delete(e.pointerId);
    if (single && !dragged && Date.now() - downAt < 500) live.onClick?.(e);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    zoomMul = Math.max(0.6, Math.min(2.2, zoomMul * (1 + Math.sign(e.deltaY) * 0.1)));
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
    onSlide?: (t: number) => void;
  };
  let live: Live = {};

  const IDLE: PickState = { count: 0, collinear: false, meeting: false };

  const FIGURES: Record<AxiomFigure, () => void> = {
    none() {
      orbit.dist = 26;
    },

    /* ---------- axiom 1, the statement ---------- */
    plane3pts() {
      const A: Vec = [-4, -2, 0], B: Vec = [3, -3, 1.5], Cp: Vec = [0, 4, -1];
      const pl = planeOf(A, B, Cp);
      planePatch(world, mul(add(add(A, B), Cp), 1 / 3), pl.n, 6.5, C.planeA, 0.2);
      ([[A, "A"], [B, "B"], [Cp, "C"]] as const).forEach(([p, nm]) => {
        dotAt(world, p, C.point, 0.24);
        tag(nm, () => add(p, [0, 0, 0.9]), LAB.target);
      });
      orbit.dist = 24;
    },

    /* ---------- axiom 1, place them yourself ---------- */
    pick3() {
      const placed: Vec[] = [];
      orbit.dist = 30;

      const draw = () => {
        wipe();
        placed.forEach((p, i) => {
          dotAt(world, p, C.point, 0.24);
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
            segment(world, placed[i], placed[i + 1], C.warn, 0.05, true);
          }
          onPick({ count: 3, collinear: true, meeting: false });
          return;
        }
        const centre = mul(add(add(placed[0], placed[1]), placed[2]), 1 / 3);
        planePatch(world, centre, pl.n, 7, C.planeA, 0.22);
        for (let i = 0; i < 3; i++) {
          segment(world, placed[i], placed[(i + 1) % 3], C.point, 0.045, true);
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
      planePatch(world, [0, 0, 0], [0, 0, 1], 6, C.planeA, 0.18);
      ([[-3.5, -2, 0], [3, -2.5, 0], [0.5, 3.5, 0]] as Vec[]).forEach((p) =>
        dotAt(world, p, C.point, 0.22),
      );
      orbit.dist = 22;
      orbit.phi = 26;
    },

    /* ---------- axiom 2, the statement ---------- */
    lineInPlane() {
      planePatch(world, [0, 0, 0], [0, 0, 1], 7, C.planeA, 0.2);
      const A: Vec = [-3, -1.4, 0], B: Vec = [2.6, 1.8, 0];
      const d = norm(sub(B, A));
      segment(world, add(A, mul(d, -4)), add(B, mul(d, 4)), C.point, 0.055, true);
      ([[A, "A"], [B, "B"]] as const).forEach(([p, nm]) => {
        dotAt(world, p, C.point, 0.24);
        tag(nm, () => add(p, [0, 0, 0.8]), LAB.target);
      });
      tag("α", () => [5.4, -5.4, 0], LAB.known);
      orbit.dist = 24;
    },

    /* ---------- axiom 2, place them yourself ---------- */
    pick2OnPlane() {
      const N = norm([0.18, -0.1, 1]);
      const P0: Vec = [0, 0, 0];
      const S = 7;
      const placed: Vec[] = [];
      orbit.dist = 26;

      const draw = () => {
        wipe();
        const pl = planePatch(world, P0, N, S, C.planeA, 0.2);
        tag("α", () => add(add(P0, mul(pl.u, S * 0.78)), mul(pl.v, -S * 0.78)), LAB.known);
        placed.forEach((p, i) => {
          dotAt(world, p, C.point, 0.24);
          tag("AB"[i], () => add(p, [0, 0, 0.8]), LAB.target);
        });
        if (placed.length === 2) {
          const line = { p: placed[0], dir: norm(sub(placed[1], placed[0])) };
          const seg = clipToRect(line, P0, pl.u, pl.v, S, S);
          if (seg) segment(world, seg[0], seg[1], C.point, 0.055, true);
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
      planePatch(world, [0, 0, 0], nA, 6, C.planeA, 0.18);
      planePatch(world, [0, 0, 0], nB, 6, C.planeB, 0.16);
      const L = meetLine(nA, 0, nB, 0);
      if (L) {
        segment(world, add(L.p, mul(L.dir, -6)), add(L.p, mul(L.dir, 6)), figColor("ink"), 0.06, true);
        tag("l", () => add(L.p, mul(L.dir, 6.6)), LAB.ink);
      }
      orbit.dist = 24;
    },

    /* ---------- axiom 3, bring the planes together ---------- */
    planeSlide() {
      const nA: Vec = [0, 0, 1];
      const tilt = (52 * Math.PI) / 180;
      const nB = norm([Math.sin(tilt), 0, Math.cos(tilt)]);
      const S = 6.5, HIGH = 9;
      let height = HIGH;
      let meeting: [Vec, Vec] | null = null;

      // Built once: the slider moves things, it never rebuilds them.
      const pa = planePatch(world, [0, 0, 0], nA, S, C.planeA, 0.17);
      const betaG = new THREE.Group();
      world.add(betaG);
      const pb = planePatch(betaG, [0, 0, 0], nB, S, C.planeB, 0.15);

      const lineMat = new THREE.MeshBasicMaterial({ color: figColor("ink") });
      lineMat.depthTest = false;
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
          lineMesh.visible = true;
          lineMesh.scale.set(1, A.distanceTo(B), 1);
          lineMesh.position.copy(A).add(B).multiplyScalar(0.5);
          lineMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize(),
          );
        } else {
          lineMesh.visible = false;
        }
        lTag.classList.toggle("hide", !meeting);
        onPick({ count: 0, collinear: false, meeting: meeting !== null });
      };

      live.onSlide = (t) => {
        height = HIGH - t * HIGH;
        move();
      };

      move();
      orbit.dist = 27;
      orbit.phi = 16;
    },

    /* ---------- axiom 3, two walls of a room ---------- */
    corner() {
      planePatch(world, [0, 0, 0], [1, 0, 0], 5, C.planeA, 0.17);
      planePatch(world, [0, 0, 0], [0, 1, 0], 5, C.planeB, 0.15);
      segment(world, [0, 0, -5], [0, 0, 5], figColor("ink"), 0.07, true);
      tag("l", () => [0, 0, 5.6], LAB.ink);
      orbit.dist = 22;
      orbit.phi = 8;
    },

    /* ---------- the toolkit ---------- */
    toolkit() {
      const nA: Vec = [0, 0, 1], nB = norm([0.6, 0.2, 0.8]);
      planePatch(world, [0, 0, 0], nA, 5.5, C.planeA, 0.15);
      planePatch(world, [0, 0, 0], nB, 5.5, C.planeB, 0.13);
      const L = meetLine(nA, 0, nB, 0);
      if (L) {
        segment(world, add(L.p, mul(L.dir, -5.5)), add(L.p, mul(L.dir, 5.5)), figColor("ink"), 0.055, true);
      }
      ([[-3, -2, 0], [2.6, -2.4, 0], [0.4, 3.2, 0]] as Vec[]).forEach((p) =>
        dotAt(world, p, C.point, 0.2),
      );
      orbit.dist = 24;
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

  let raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    if (autoSpin) orbit.theta -= 0.08;
    applyOrbit();
    renderer.render(scene, camera);
    updateTags();
  }

  /* ============================================================
     update
     ============================================================ */

  let current: AxiomFigure | null = null;
  let currentReset = -1;
  let slide = 0;

  function build(figure: AxiomFigure) {
    wipe();
    live = {};
    orbit.phi = 22;
    zoomMul = 1;
    autoSpin = true;
    onPick(IDLE);
    FIGURES[figure]();
    // A figure with a slider is rebuilt at whatever the slider already reads,
    // so paging away and back does not silently lift β again.
    live.onSlide?.(slide);
    resize();
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
  applyOrbit();
  tick();

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
