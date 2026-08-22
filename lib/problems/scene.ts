import * as THREE from "three";
import type { Problem } from "./data";
import { keyOf, nice, nm, type Points } from "./geometry";

/**
 * The problem stage's 3D figure, ported from legacy/problems.html.
 *
 * Like the explainer scene it owns its canvas, its RAF loop and its DOM
 * overlay (the point pins and the length labels), and React pushes plain data
 * in. Pin selection lives here rather than in React because it is driven by
 * per-frame projected positions; picking three points calls back out.
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

const COL = {
  given: 0x6e7a74, found: 0x2b4fe8, built: 0xe39a22, target: 0xe8442a,
  blue: 0x2b4fe8, red: 0xe8442a, amber: 0xe39a22,
} as const;

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

  const planeG = new THREE.Group(), structG = new THREE.Group();
  const addG = new THREE.Group(), hlG = new THREE.Group(), targetG = new THREE.Group();
  world.add(planeG, structG, addG, hlG, targetG);

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
      const c = g.children[0] as THREE.Mesh;
      g.remove(c);
      c.geometry?.dispose();
      const m = c.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    }
  }
  /** Everything scales off the figure's own size, so all four problems read alike. */
  function scaleOf() {
    let m = 0;
    for (const k in PT) m = Math.max(m, Math.hypot(PT[k][0], PT[k][1], PT[k][2]));
    return m / 12;
  }
  const alive = (k: string) => BORN[k] !== undefined && BORN[k] <= shown;

  /**
   * A point exists only once the statement gives it or a step builds it, so
   * the figure starts genuinely unfinished — which is the stage's whole point.
   */
  function bornAt(p: Problem): Record<string, number> {
    const born: Record<string, number> = {};
    p.wire.forEach((e) => { born[e[0]] = 0; born[e[1]] = 0; });
    (p.known ?? []).forEach((e) => { born[e[0]] = 0; born[e[1]] = 0; });
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
      const t = tube(COL.given, 0.055 * s, 0.9);
      place(t, PT[e[0]], PT[e[1]]);
      structG.add(t);
    });
  }

  function buildPlane() {
    clearG(planeG);
    if (!LV?.plane || shown < LV.plane.at) return;
    const q = LV.plane.quad();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(
      [...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]], 3));
    planeG.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: COL.amber, transparent: true, opacity: 0.13, side: THREE.DoubleSide,
    })));
    const s = scaleOf();
    for (let i = 0; i < 4; i++) {
      const t = tube(COL.amber, 0.04 * s, 0.75);
      place(t, q[i], q[(i + 1) % 4]);
      planeG.add(t);
    }
  }

  function buildTarget() {
    clearG(targetG);
    if (!LV || !alive(LV.target[0]) || !alive(LV.target[1])) return;
    const t = tube(COL.red, 0.075 * scaleOf(), 0.92);
    place(t, PT[LV.target[0]], PT[LV.target[1]]);
    targetG.add(t);
  }

  function buildAdded() {
    clearG(addG);
    if (!LV) return;
    const s = scaleOf();
    for (let i = 0; i < shown; i++) {
      (LV.steps[i].add ?? []).forEach((e) => {
        if (e[2] === "amber") {
          // A construction line — the learner drew it, so it reads as dashes.
          const A = new THREE.Vector3(...PT[e[0]]);
          const B = new THREE.Vector3(...PT[e[1]]);
          const n = Math.max(6, Math.round(A.distanceTo(B) / (0.9 * s)));
          for (let j = 0; j < n; j += 2) {
            const p1 = A.clone().lerp(B, j / n);
            const p2 = A.clone().lerp(B, Math.min(1, (j + 1) / n));
            const d = tube(COL.amber, 0.055 * s, 1);
            place(d, p1.toArray(), p2.toArray());
            addG.add(d);
          }
          return;
        }
        const t = tube(COL[e[2]] ?? COL.blue, 0.07 * s, 1);
        place(t, PT[e[0]], PT[e[1]]);
        addG.add(t);
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
          setTimeout(() => b.classList.remove("new"), 600);
        }
      } else if (pinEls[k]) {
        pinEls[k].remove();
        delete pinEls[k];
      }
    });
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
    if ((e.target as HTMLElement)?.closest(".pin")) return;
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
    if (spin) orbit.theta -= 0.09;
    applyOrbit();
    renderer.render(scene, camera);

    const w = stage.clientWidth, h = stage.clientHeight;
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

  function rebuild() {
    buildStructure(); buildAdded(); buildPlane(); buildTarget();
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
    zoomMul = 1;
    spin = true;
    resize();
  }

  function setShown(n: number) {
    if (!LV) return;
    const grew = n > shown;
    // Mark the newest length so it pings, as the original did.
    if (grew) {
      const step = LV.steps[n - 1];
      const first = step?.lens?.[0];
      freshKey = first ? keyOf(first[0], first[1]) : null;
    }
    shown = n;
    rebuild();
    if (grew && freshKey) {
      if (freshTimer) clearTimeout(freshTimer);
      freshTimer = setTimeout(() => { freshKey = null; syncLens(); }, 900);
    }
    spin = false;
  }

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
      if (freshTimer) clearTimeout(freshTimer);
      window.removeEventListener("resize", resize);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("wheel", onWheel);
      clearPins(); clearLens();
      [planeG, structG, addG, hlG, targetG].forEach(clearG);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
