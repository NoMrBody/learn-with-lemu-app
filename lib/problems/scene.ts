import * as THREE from "three";
import type { Problem } from "./data";
import { keyOf, nice, nm, type Points } from "./geometry";
import { figColor, onFigureTheme } from "@/lib/figure-theme";
import { onReducedMotion, prefersReducedMotion } from "@/lib/reduced-motion";

/**
 * The problem stage's 3D figure, ported from legacy/problems.html.
 *
 * Like the explainer scene it owns its canvas, its RAF loop and its DOM
 * overlay (the point pins and the length labels), and React pushes plain data
 * in. Pin selection lives here rather than in React because it is driven by
 * per-frame projected positions; picking three points calls back out.
 *
 * Construction is animated. `Problem.steps[i].add` is already an ordered list
 * of the segments a step draws, with step 0 being the bare solid, so revealing
 * step i hands its segments to the draw queue below: each one grows from its
 * first point to its second, one after another, and a point that this step
 * brings into being waits hidden until its line arrives. That is the whole
 * teaching value — you see where a construction line comes from and where it
 * lands, rather than finding it already there.
 */

export type Tri3 = readonly [string, string, string];

export type ProblemScene = {
  /** Switch to a problem and reset the figure to its "nothing revealed" state. */
  load: (problem: Problem, points: Points, shown: number) => void;
  /** Reveal the figure up to `shown` steps. */
  setShown: (shown: number) => void;
  /** Tint one triangle; `mine` marks a scratchpad triangle rather than a step's. */
  highlight: (keys: Tri3 | null, mine?: boolean) => void;
  stopSpin: () => void;
  resize: () => void;
  dispose: () => void;
};

// The semantic colours are literal on purpose: blue means "you have this
// length", amber means "you built it", red means "this is what you want", and
// those readings must survive a theme change. Only `given` — the plain edges
// of the figure — is structural, so only it follows the theme.
const COL = {
  found: 0x2b4fe8, built: 0xe39a22, target: 0xe8442a,
  blue: 0x2b4fe8, red: 0xe8442a, amber: 0xe39a22,
} as const;

/**
 * Drawing speeds, in ms. Fast enough not to be a wait, slow enough that the
 * eye can follow the far end travelling. The answer line gets a little longer
 * because it is the conclusion. GAP > GROW by design: one segment finishes
 * before the next begins, so a step that adds four of them reads as four
 * separate acts rather than a bloom.
 */
const GROW_MS = 320;
const GROW_TARGET_MS = 420;
const GAP_MS = 360;
const GAP_TARGET_MS = 520;
const DASH_MS = 40;

/** Where the camera stands when a problem does not ask for somewhere else. */
const HOME_VIEW = { theta: -58, phi: 20 } as const;

export function createProblemScene(
  stage: HTMLElement,
  layer: HTMLElement,
  opts: { onTriangle: (keys: Tri3) => void },
): ProblemScene {
  THREE.ColorManagement.enabled = false;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  stage.insertBefore(renderer.domElement, layer);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
  camera.up.set(0, 0, 1);
  // The original lit this with ambient only — every material here is
  // MeshBasicMaterial, so it is really just belt and braces.
  scene.add(new THREE.AmbientLight(0xffffff, 0.95 * Math.PI));
  const world = new THREE.Group();
  scene.add(world);

  const facesG = new THREE.Group(), planeG = new THREE.Group(), structG = new THREE.Group();
  const addG = new THREE.Group(), hlG = new THREE.Group(), targetG = new THREE.Group();
  world.add(facesG, planeG, structG, addG, hlG, targetG);

  let LV: Problem | null = null;
  let PT: Points = {};
  let BORN: Record<string, number> = {};
  let shown = 0;
  let picks: string[] = [];
  let spin = true;
  let zoomMul = 1;

  const orbit = { theta: -58, phi: 20, dist: 34, target: new THREE.Vector3() };

  /* ---- builders ---- */
  function tube(color: number, r: number, op = 1) {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 1, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op }),
    );
  }
  function place(m: THREE.Mesh, p: readonly number[], q: readonly number[]) {
    const A = new THREE.Vector3(p[0], p[1], p[2]);
    const B = new THREE.Vector3(q[0], q[1], q[2]);
    const L = A.distanceTo(B);
    if (L < 1e-6) { m.visible = false; return; }
    m.visible = true;
    m.scale.set(1, L, 1);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  }
  function clearG(g: THREE.Group) {
    while (g.children.length) {
      // Meshes for the tubes and fills, Lines for the angle arcs. Both carry a
      // geometry and a material, which is all this needs.
      const c = g.children[0] as THREE.Mesh | THREE.Line;
      g.remove(c);
      c.geometry?.dispose();
      const m = c.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  }
  /** Everything scales off the figure's own size, so every problem reads alike. */
  function scaleOf() {
    let m = 0;
    for (const k in PT) m = Math.max(m, Math.hypot(PT[k][0], PT[k][1], PT[k][2]));
    return m / 12;
  }
  const alive = (k: string) => BORN[k] !== undefined && BORN[k] <= shown;

  /* ---- the draw queue ----
     One job per segment being drawn. `tick` walks it; nothing here uses a
     timer, so a rebuild mid-animation drops the lot cleanly. */

  type DrawJob = {
    m: THREE.Mesh;
    A: THREE.Vector3;
    B: THREE.Vector3;
    L: number;
    /** performance.now() at which this job starts. */
    t0: number;
    ms: number;
    /** A dash of a construction line: it appears whole rather than growing. */
    dash?: true;
    /** A point that waits, hidden, until this line reaches it. */
    lands?: string;
  };

  let drawing: DrawJob[] = [];
  /** Pairs currently being drawn, so nothing else draws them at the same time. */
  const animating = new Set<string>();
  /** Points holding their entrance until their line arrives. */
  const holdPins: Record<string, boolean> = {};
  const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  function growSeg(
    m: THREE.Mesh, p: readonly number[], q: readonly number[],
    ms: number, delay: number, lands?: string,
  ) {
    const A = new THREE.Vector3(p[0], p[1], p[2]);
    const B = new THREE.Vector3(q[0], q[1], q[2]);
    const L = A.distanceTo(B);
    if (L < 1e-6) { m.visible = false; return; }
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    m.visible = false;
    // Only a point this step actually brings into being waits for its line.
    // Holding one that is already on screen would read as a flicker.
    const hold = lands !== undefined && BORN[lands] === shown;
    if (hold) {
      holdPins[lands] = true;
      if (pinEls[lands]) pinEls[lands].style.visibility = "hidden";
    }
    drawing.push({ m, A, B, L, t0: nowMs() + delay, ms, lands: hold ? lands : undefined });
  }

  /** A dash waits its turn and then simply appears. */
  function showAt(m: THREE.Mesh, delay: number) {
    m.visible = false;
    drawing.push({
      m, A: new THREE.Vector3(), B: new THREE.Vector3(), L: 0,
      t0: nowMs() + delay, ms: 1, dash: true,
    });
  }

  function stepDrawing() {
    if (!drawing.length) return;
    const t = nowMs();
    const keep: DrawJob[] = [];
    for (const d of drawing) {
      if (t < d.t0) { keep.push(d); continue; }
      if (d.dash) { d.m.visible = true; continue; }
      const k = Math.min(1, (t - d.t0) / d.ms);
      // Ease in and out, so the line starts and lands softly.
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      d.m.visible = true;
      d.m.scale.set(1, Math.max(1e-4, d.L * e), 1);
      // The near end stays put and the far end travels — which is the whole
      // point: you can see which way round the segment was drawn.
      d.m.position.copy(d.A.clone().lerp(d.B, e / 2));
      if (k < 1) keep.push(d);
      else if (d.lands) landPin(d.lands);
    }
    drawing = keep;
    // The last line has landed, so the persistent target tube can take over.
    if (!drawing.length && animating.size) { animating.clear(); buildTarget(); }
  }

  function stopDrawing() {
    drawing = [];
    animating.clear();
    for (const k in holdPins) {
      if (holdPins[k]) { holdPins[k] = false; if (pinEls[k]) pinEls[k].style.visibility = ""; }
    }
  }

  /**
   * A point exists only once the statement gives it or a step builds it, so
   * the figure starts genuinely unfinished — which is the stage's whole point.
   */
  function bornAt(p: Problem): Record<string, number> {
    const born: Record<string, number> = {};
    p.wire.forEach((e) => { born[e[0]] = 0; born[e[1]] = 0; });
    (p.known ?? []).forEach((e) => { born[e[0]] = 0; born[e[1]] = 0; });
    // Whatever the statement draws for you is there from the very first frame.
    // A cuboid needs this: no step ever names its far corners, so without it
    // they would be born at 99 and never appear.
    (p.atStart ?? []).forEach((k) => { born[k] = 0; });
    p.steps.forEach((st, i) => {
      const mark = (k: string) => { if (born[k] === undefined) born[k] = i + 1; };
      (st.add ?? []).forEach((x) => { mark(x[0]); mark(x[1]); });
      (st.lens ?? []).forEach((x) => { mark(x[0]); mark(x[1]); });
      (st.board ?? []).forEach(mark);
    });
    Object.keys(PT).forEach((k) => { if (born[k] === undefined) born[k] = 99; });
    return born;
  }

  function buildStructure() {
    clearG(structG);
    if (!LV) return;
    const s = scaleOf();
    LV.wire.forEach((e) => {
      const t = tube(figColor("dim"), 0.055 * s, 0.9);
      place(t, PT[e[0]], PT[e[1]]);
      structG.add(t);
    });
  }

  /**
   * The surfaces the statement itself names — the floor a diagonal leans on,
   * the two faces of a fold. Drawn from step 0, because they were given rather
   * than built. Fan-triangulated, so a triangular face needs no special case.
   */
  function buildFaces() {
    clearG(facesG);
    if (!LV?.faces) return;
    const s = scaleOf();
    LV.faces.forEach((f) => {
      const q = f.quad();
      const pos: number[] = [];
      for (let i = 1; i < q.length - 1; i++) pos.push(...q[0], ...q[i], ...q[i + 1]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      const col = COL[f.col];
      const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: f.op ?? 0.11,
        side: THREE.DoubleSide, depthWrite: false,
      }));
      // A face and the lines drawn in it are coplanar — the section plane IS
      // the four segments the first step traces. Three.js sorts the
      // transparent pass by distance, so at equal depth the order is
      // arbitrary, and a face that lands last composites its tint over every
      // line underneath and greys them out. Drawing faces first fixes the
      // order: lines always go on top of the surface they lie in.
      mesh.renderOrder = -1;
      facesG.add(mesh);
      for (let i = 0; i < q.length; i++) {
        const t = tube(col, 0.035 * s, 0.6);
        place(t, q[i], q[(i + 1) % q.length]);
        t.renderOrder = -1;
        facesG.add(t);
      }
    });
  }

  /** An arc between two directions, drawn where two planes hinge. */
  function hingeArc(
    g: THREE.Group, at: readonly number[],
    d1: readonly number[], d2: readonly number[], r: number, col: number,
  ) {
    const O = new THREE.Vector3(at[0], at[1], at[2]);
    const U = new THREE.Vector3(d1[0], d1[1], d1[2]).normalize();
    const V = new THREE.Vector3(d2[0], d2[1], d2[2]).normalize();
    const ax = new THREE.Vector3().crossVectors(U, V);
    if (ax.lengthSq() < 1e-12) return;
    ax.normalize();
    const tot = U.angleTo(V);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 26; i++) {
      pts.push(O.clone().add(U.clone().applyAxisAngle(ax, (tot * i) / 26).multiplyScalar(r)));
    }
    const mat = new THREE.LineBasicMaterial({ color: col });
    mat.depthTest = false;
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    l.renderOrder = 12;
    g.add(l);
  }

  function buildPlane() {
    clearG(planeG);
    if (angLabel) { angLabel.el.remove(); angLabel = null; }
    if (!LV?.plane || shown < LV.plane.at) return;
    const q = LV.plane.quad();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(
      [...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]], 3));
    const fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: COL.amber, transparent: true, opacity: 0.13,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    fill.renderOrder = -1;
    planeG.add(fill);
    const s = scaleOf();
    for (let i = 0; i < 4; i++) {
      const t = tube(COL.amber, 0.04 * s, 0.75);
      place(t, q[i], q[(i + 1) % 4]);
      t.renderOrder = -1;
      planeG.add(t);
    }

    // Mark the angle the statement names, right where the two planes meet, so
    // the given α is attached to something rather than floating in the prose.
    const { hinge, angle } = LV.plane;
    if (!hinge || !angle || !PT[hinge[0]] || !PT[hinge[1]]) return;
    const H0 = PT[hinge[0]], H1 = PT[hinge[1]];
    const mid: [number, number, number] = [
      (H0[0] + H1[0]) / 2, (H0[1] + H1[1]) / 2, (H0[2] + H1[2]) / 2,
    ];
    const into = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
    // Big enough to read, small enough to stay clear of the plane's far edge.
    const r = 0.2 * Math.hypot(H1[0] - H0[0], H1[1] - H0[1], H1[2] - H0[2]);
    hingeArc(planeG, mid, [0, 1, 0], into, r, COL.amber);
    const el = document.createElement("div");
    el.className = "anglab";
    el.textContent = angle.label;
    layer.appendChild(el);
    angLabel = { el, at: [mid[0], mid[1] + 0.8 * r, mid[2] + 0.27 * r] };
  }

  function buildTarget() {
    clearG(targetG);
    if (!LV || !alive(LV.target[0]) || !alive(LV.target[1])) return;
    // Several steps add a red segment on the very pair the target names. While
    // that one is growing, this persistent tube would give the ending away, so
    // it waits; stepDrawing calls back here once the queue drains.
    if (animating.has(keyOf(LV.target[0], LV.target[1]))) return;
    const t = tube(COL.red, 0.075 * scaleOf(), 0.92);
    place(t, PT[LV.target[0]], PT[LV.target[1]]);
    targetG.add(t);
  }

  /**
   * Every segment the revealed steps have added. `animateStep`, when given, is
   * the one step whose segments should be drawn rather than placed — the step
   * just revealed. Everything earlier is already history and appears whole.
   */
  function buildAdded(animateStep?: number) {
    clearG(addG);
    if (!LV) return;
    const s = scaleOf();
    let delay = 0;
    for (let i = 0; i < shown; i++) {
      const live = i === animateStep;
      (LV.steps[i].add ?? []).forEach((e) => {
        if (e[2] === "amber") {
          // A construction line — the learner drew it, so it reads as dashes.
          const A = new THREE.Vector3(...PT[e[0]]);
          const B = new THREE.Vector3(...PT[e[1]]);
          const n = Math.max(6, Math.round(A.distanceTo(B) / (0.9 * s)));
          let j = 0;
          for (let k = 0; k < n; k += 2) {
            const p1 = A.clone().lerp(B, k / n);
            const p2 = A.clone().lerp(B, Math.min(1, (k + 1) / n));
            const d = tube(COL.amber, 0.055 * s, 1);
            place(d, p1.toArray(), p2.toArray());
            addG.add(d);
            // The dashes arrive one after another, so the line still has a
            // direction even though it is not one continuous stroke.
            if (live) showAt(d, delay + j * DASH_MS);
            j++;
          }
          if (live) { animating.add(keyOf(e[0], e[1])); delay += GAP_MS; }
          return;
        }
        const isTarget = e[2] === "red";
        const t = tube(COL[e[2]] ?? COL.blue, 0.07 * s, 1);
        addG.add(t);
        if (live) {
          growSeg(t, PT[e[0]], PT[e[1]], isTarget ? GROW_TARGET_MS : GROW_MS, delay, e[1]);
          animating.add(keyOf(e[0], e[1]));
          delay += isTarget ? GAP_TARGET_MS : GAP_MS;
        } else {
          place(t, PT[e[0]], PT[e[1]]);
        }
      });
    }
  }

  function highlight(keys: Tri3 | null, mine = false) {
    clearG(hlG);
    if (!keys) return;
    const col = mine ? COL.amber : COL.blue;
    const s = scaleOf();
    const p = keys.map((k) => PT[k]);
    if (p.some((x) => !x)) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...p[0], ...p[1], ...p[2]], 3));
    hlG.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.13, side: THREE.DoubleSide,
    })));
    for (let i = 0; i < 3; i++) {
      const t = tube(col, 0.05 * s, 0.9);
      place(t, p[i], p[(i + 1) % 3]);
      hlG.add(t);
    }
  }

  /* ---- pins ---- */
  const pinEls: Record<string, HTMLButtonElement> = {};
  /** The letter naming a given angle, projected each frame like a pin. */
  let angLabel: { el: HTMLDivElement; at: readonly [number, number, number] } | null = null;
  function syncPins() {
    Object.keys(PT).forEach((k) => {
      if (alive(k)) {
        if (!pinEls[k]) {
          const b = document.createElement("button");
          b.className = "pin new";
          b.type = "button";
          b.textContent = nm(k);
          b.setAttribute("aria-label", `Point ${nm(k)}`);
          b.onclick = () => pick(k);
          layer.appendChild(b);
          pinEls[k] = b;
          // Built before its line has reached it — it waits.
          if (holdPins[k]) b.style.visibility = "hidden";
          setTimeout(() => b.classList.remove("new"), 600);
        }
      } else if (pinEls[k]) {
        pinEls[k].remove();
        delete pinEls[k];
      }
    });
  }
  /** The point arrives as the line reaches it, rather than before. */
  function landPin(k: string) {
    holdPins[k] = false;
    const b = pinEls[k];
    if (!b) return;
    b.style.visibility = "";
    b.classList.add("new");
    setTimeout(() => b.classList.remove("new"), 600);
  }

  function pick(k: string) {
    const i = picks.indexOf(k);
    if (i >= 0) picks.splice(i, 1);
    else {
      if (picks.length >= 3) picks.shift();
      picks.push(k);
    }
    for (const p in pinEls) pinEls[p].classList.toggle("on", picks.includes(p));
    if (picks.length === 3) {
      const keys = picks.slice() as unknown as Tri3;
      picks = [];
      for (const q in pinEls) pinEls[q].classList.remove("on");
      opts.onTriangle(keys);
    }
  }
  function clearPins() {
    for (const k in pinEls) { pinEls[k].remove(); delete pinEls[k]; }
    for (const k in holdPins) delete holdPins[k];
    picks = [];
  }

  /* ---- length labels ---- */
  const lenEls: Record<string, HTMLDivElement> = {};
  let freshKey: string | null = null;
  let freshTimer: ReturnType<typeof setTimeout> | null = null;

  function wantedLens(): Record<string, readonly [string, string]> {
    const want: Record<string, readonly [string, string]> = {};
    if (!LV) return want;
    (LV.known ?? []).forEach((e) => { want[keyOf(e[0], e[1])] = e; });
    for (let i = 0; i < shown; i++) {
      (LV.steps[i].lens ?? []).forEach((e) => { want[keyOf(e[0], e[1])] = e; });
    }
    return want;
  }
  function syncLens() {
    if (!LV) return;
    const want = wantedLens();
    for (const k in lenEls) {
      if (!want[k]) { lenEls[k].remove(); delete lenEls[k]; }
    }
    const tgt = keyOf(LV.target[0], LV.target[1]);
    for (const k in want) {
      const e = want[k];
      if (!alive(e[0]) || !alive(e[1])) continue;
      if (!lenEls[k]) {
        const el = document.createElement("div");
        layer.appendChild(el);
        lenEls[k] = el;
      }
      const isGiven = (LV.known ?? []).some((g) => keyOf(g[0], g[1]) === k);
      lenEls[k].className =
        "len" + (k === tgt ? " tgt" : isGiven ? " given" : "") + (freshKey === k ? " fresh" : "");
      lenEls[k].textContent = nice(
        Math.hypot(PT[e[0]][0] - PT[e[1]][0], PT[e[0]][1] - PT[e[1]][1], PT[e[0]][2] - PT[e[1]][2]),
      );
      lenEls[k].dataset.a = e[0];
      lenEls[k].dataset.b = e[1];
    }
  }
  function clearLens() {
    for (const k in lenEls) { lenEls[k].remove(); delete lenEls[k]; }
    freshKey = null;
  }

  /* ---- camera ---- */
  function frameFigure() {
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (const k in PT) { cx += PT[k][0]; cy += PT[k][1]; cz += PT[k][2]; n++; }
    if (!n) return;
    cx /= n; cy /= n; cz /= n;
    orbit.target.set(cx, cy, cz);
    let r = 0;
    for (const k in PT) {
      r = Math.max(r, Math.hypot(PT[k][0] - cx, PT[k][1] - cy, PT[k][2] - cz));
    }
    orbit.dist = (r / Math.sin((19 * Math.PI) / 180)) * 1.25;
  }
  function applyOrbit() {
    const t = (orbit.theta * Math.PI) / 180;
    const p = (orbit.phi * Math.PI) / 180;
    const d = orbit.dist * zoomMul;
    camera.position
      .set(d * Math.cos(p) * Math.cos(t), d * Math.cos(p) * Math.sin(t), d * Math.sin(p))
      .add(orbit.target);
    camera.lookAt(orbit.target);
  }

  /* ---- input ---- */
  const ptrs = new Map<number, [number, number]>();
  let lx = 0, ly = 0, pd = 0;
  const d2 = () => {
    const a = [...ptrs.values()];
    return Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) || 1;
  };
  const onDown = (e: PointerEvent) => {
    // Anything interactive layered over the figure keeps its own clicks.
    // Capturing the pointer below retargets the whole gesture at the stage,
    // so pointerup — and with it the click — would never reach the control.
    if ((e.target as HTMLElement)?.closest(".pin, .fig-control")) return;
    stage.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) { lx = e.clientX; ly = e.clientY; }
    else if (ptrs.size === 2) pd = d2();
    spin = false;
  };
  const onMove = (e: PointerEvent) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) {
      orbit.theta -= (e.clientX - lx) * 0.4;
      orbit.phi = Math.max(-84, Math.min(84, orbit.phi + (e.clientY - ly) * 0.34));
      lx = e.clientX; ly = e.clientY;
    } else if (ptrs.size === 2) {
      const d = d2();
      if (pd) zoomMul = Math.max(0.6, Math.min(2.2, (zoomMul * pd) / d));
      pd = d;
    }
  };
  const onUp = (e: PointerEvent) => ptrs.delete(e.pointerId);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    zoomMul = Math.max(0.6, Math.min(2.2, zoomMul * (1 + Math.sign(e.deltaY) * 0.1)));
  };
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);
  stage.addEventListener("wheel", onWheel, { passive: false });

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  /* ---- loop ---- */
  const _v = new THREE.Vector3();
  let raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    stepDrawing();
    // The idle turn is motion nobody asked for, so it goes when they ask for less.
    if (spin && !reduced) orbit.theta -= 0.09;
    applyOrbit();
    renderer.render(scene, camera);

    const w = stage.clientWidth, h = stage.clientHeight;
    if (angLabel) {
      _v.set(...angLabel.at).project(camera);
      angLabel.el.style.left = (_v.x * 0.5 + 0.5) * w + "px";
      angLabel.el.style.top = (-_v.y * 0.5 + 0.5) * h + "px";
      angLabel.el.style.opacity = _v.z > 1 ? "0" : "1";
    }
    for (const k in pinEls) {
      if (!PT[k]) continue;
      _v.set(...PT[k]).project(camera);
      pinEls[k].style.left = (_v.x * 0.5 + 0.5) * w + "px";
      pinEls[k].style.top = (-_v.y * 0.5 + 0.5) * h + "px";
    }
    for (const k in lenEls) {
      const el = lenEls[k], a = el.dataset.a!, b = el.dataset.b!;
      if (!PT[a] || !PT[b]) continue;
      _v.set(
        (PT[a][0] + PT[b][0]) / 2, (PT[a][1] + PT[b][1]) / 2, (PT[a][2] + PT[b][2]) / 2,
      ).project(camera);
      el.style.left = (_v.x * 0.5 + 0.5) * w + "px";
      el.style.top = (-_v.y * 0.5 + 0.5) * h + "px";
      el.style.opacity = _v.z > 1 ? "0" : "1";
    }
  }

  /**
   * Redraw everything at the current `shown`. Pass `animateStep` to have that
   * one step's segments drawn rather than placed; leave it off — as the theme
   * handler does — and the figure simply appears in its finished state.
   */
  function rebuild(animateStep?: number) {
    stopDrawing();
    buildStructure(); buildFaces(); buildAdded(animateStep);
    // buildTarget stands aside for anything in `animating`, and stepDrawing is
    // what lifts that. If nothing was actually queued — every segment of this
    // step was zero-length — nothing would ever lift it, so lift it here.
    if (!drawing.length) animating.clear();
    buildPlane(); buildTarget();
    syncPins(); syncLens();
  }

  function load(problem: Problem, points: Points, atStep: number) {
    LV = problem;
    PT = points;
    shown = atStep;
    BORN = bornAt(problem);
    clearPins(); clearLens();
    clearG(hlG);
    rebuild();
    frameFigure();
    // Some problems only read correctly from one angle — 14.57's stated angle
    // shows at its true size from a low left. The rest open square on.
    const v = problem.view ?? HOME_VIEW;
    orbit.theta = v.theta;
    orbit.phi = v.phi;
    zoomMul = 1;
    spin = true;
    resize();
  }

  function setShown(n: number) {
    if (!LV) return;
    const grew = n > shown;
    // Mark the newest length so it pings, as the original did. Stepping the
    // figure back is not a discovery, so nothing pings on the way down.
    if (grew) {
      const step = LV.steps[n - 1];
      const first = step?.lens?.[0];
      freshKey = first ? keyOf(first[0], first[1]) : null;
    } else {
      freshKey = null;
    }
    shown = n;
    // Only the step that just arrived is drawn; going back, it is a removal.
    rebuild(grew && !reduced ? n - 1 : undefined);
    if (grew && freshKey) {
      if (freshTimer) clearTimeout(freshTimer);
      freshTimer = setTimeout(() => { freshKey = null; syncLens(); }, 900);
    }
    spin = false;
  }

  let reduced = prefersReducedMotion();
  const stopReduced = onReducedMotion(() => {
    reduced = prefersReducedMotion();
    // Asking for less motion mid-draw lands the figure where it was heading
    // rather than freezing it half-drawn.
    if (reduced && LV) rebuild();
  });

  const stopTheme = onFigureTheme(() => {
    // rebuild() regenerates every mesh from the current colours, so replaying
    // it is all a theme change needs.
    if (LV) rebuild();
  });

  resize();
  applyOrbit();
  tick();

  return {
    load,
    setShown,
    highlight,
    stopSpin: () => { spin = false; },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      stopTheme();
      stopReduced();
      stopDrawing();
      if (angLabel) { angLabel.el.remove(); angLabel = null; }
      if (freshTimer) clearTimeout(freshTimer);
      window.removeEventListener("resize", resize);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("wheel", onWheel);
      clearPins(); clearLens();
      [facesG, planeG, structG, addG, hlG, targetG].forEach(clearG);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
