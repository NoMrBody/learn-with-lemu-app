import * as THREE from "three";
import { XR, type Level, type Points } from "./levels";
import { fmtPlain, keyOf, nm, type GameState } from "./engine";

/**
 * The puzzle's 3D figure, ported from legacy/game.html. Owns its canvas, RAF
 * loop and DOM overlay (pins and length chips); React pushes game state in and
 * gets point taps back out.
 */

export type GameScene = {
  load: (level: Level, state: GameState) => void;
  update: (
    state: GameState,
    picks: readonly string[],
    solved: boolean,
    freshKey: string | null,
    target: readonly [string, string],
  ) => void;
  resize: () => void;
  dispose: () => void;
};

export function createGameScene(
  stage: HTMLElement,
  layer: HTMLElement,
  opts: { onPick: (k: string) => void },
): GameScene {
  THREE.ColorManagement.enabled = false;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  stage.insertBefore(renderer.domElement, layer);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500);
  camera.up.set(0, 0, 1);
  scene.add(new THREE.AmbientLight(0xffffff, 0.95 * Math.PI));
  const world = new THREE.Group();
  scene.add(world);
  const structG = new THREE.Group(), segLayer = new THREE.Group();
  world.add(structG, segLayer);

  let LV: Level | null = null;
  let PT: Points = {};
  let spin = true;
  let zoomMul = 1;
  const orbit = { theta: -62, phi: 18, dist: 40, target: new THREE.Vector3() };

  const gScale = () => (LV?.kind === "dihedral" ? 1 : 2.6);

  function tube(color: number, r: number, op = 1) {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 1, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op }),
    );
  }
  function put(m: THREE.Mesh, p: readonly number[], q: readonly number[]) {
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
      if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m?.dispose();
    }
  }
  const poly = (color: number, op: number, pts: readonly (readonly number[])[]) => {
    const g = new THREE.BufferGeometry();
    const v = pts.length === 4
      ? [...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3]]
      : [...pts[0], ...pts[1], ...pts[2]];
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: op, side: THREE.DoubleSide,
    }));
  };

  function buildStructure() {
    clearG(structG);
    if (!LV) return;
    const P = PT;
    const faint = (p: readonly number[], q: readonly number[]) => {
      const t = tube(0x93a09a, 0.02 * gScale(), 0.8);
      put(t, p, q);
      structG.add(t);
    };

    if (LV.kind === "dihedral") {
      // Two half-planes hinged on the edge, drawn wide enough to read as faces.
      const EX0 = -1.2, EX1 = 6.6, FD = 5;
      structG.add(poly(0x93a9e8, 0.14, [[EX0, 0, 0], [EX1, 0, 0], [EX1, FD, 0], [EX0, FD, 0]]));
      structG.add(poly(0x93a9e8, 0.2, [
        [EX0, 0, 0], [EX1, 0, 0],
        [EX1, FD * Math.cos(XR), FD * Math.sin(XR)],
        [EX0, FD * Math.cos(XR), FD * Math.sin(XR)],
      ]));
      const e = tube(0x14181a, 0.026, 0.85);
      put(e, [EX0, 0, 0], [EX1, 0, 0]);
      structG.add(e);
    } else if (LV.kind === "box") {
      ([["A", "B", "C", "D"], ["A1", "B1", "C1", "D1"]] as const).forEach((f) => {
        structG.add(poly(0x93a9e8, 0.12, [P[f[0]], P[f[1]], P[f[2]], P[f[3]]]));
      });
      LV.wire.forEach((e) => faint(P[e[0]], P[e[1]]));
    } else {
      structG.add(poly(0x93a9e8, 0.16, [P.A, P.B, P.C, P.D]));
      (["A", "B", "C", "D"] as const).forEach((k, i) => {
        const nx = (["B", "C", "D", "A"] as const)[i];
        structG.add(poly(0x93a9e8, 0.1, [P[k], P[nx], P.S]));
      });
      LV.wire.forEach((e) => faint(P[e[0]], P[e[1]]));
    }
  }

  function redrawSegments(state: GameState, solved: boolean, target: readonly [string, string]) {
    clearG(segLayer);
    for (const k of Object.keys(state.knownLen)) {
      const [p, q] = k.split("|");
      if (!PT[p] || !PT[q]) continue;
      const t = tube(0x2340c4, 0.048 * gScale());
      put(t, PT[p], PT[q]);
      segLayer.add(t);
    }
    const g = tube(0xe8442a, 0.066 * gScale(), solved ? 1 : 0.92);
    put(g, PT[target[0]], PT[target[1]]);
    segLayer.add(g);
  }

  /* ---- pins ---- */
  const pinEls: Record<string, HTMLButtonElement> = {};
  function syncPins(order: readonly string[], picks: readonly string[]) {
    order.forEach((k) => {
      if (!pinEls[k]) {
        const el = document.createElement("button");
        el.className = "gpin";
        el.type = "button";
        el.textContent = nm(k);
        el.setAttribute("aria-label", `Point ${nm(k)}`);
        el.onclick = () => opts.onPick(k);
        layer.appendChild(el);
        pinEls[k] = el;
      }
      const i = picks.indexOf(k);
      pinEls[k].classList.toggle("sel", i >= 0);
      pinEls[k].querySelector(".ord")?.remove();
      if (i >= 0) {
        const s = document.createElement("span");
        s.className = "ord";
        s.textContent = String(i + 1);
        pinEls[k].appendChild(s);
      }
    });
    for (const k in pinEls) {
      if (!order.includes(k)) { pinEls[k].remove(); delete pinEls[k]; }
    }
  }
  const clearPins = () => {
    for (const k in pinEls) { pinEls[k].remove(); delete pinEls[k]; }
  };

  /* ---- length chips ---- */
  const lenEls: Record<string, HTMLDivElement> = {};
  function syncLens(
    state: GameState, freshKey: string | null, target: readonly [string, string],
  ) {
    const want: Record<string, "known" | "target"> = {};
    for (const k of Object.keys(state.knownLen)) want[k] = "known";
    // The unknown target reads "?" until it is found.
    if (state.knownLen[keyOf(target[0], target[1])] === undefined)
      want[keyOf(target[0], target[1])] = "target";

    for (const id in lenEls) if (!want[id]) { lenEls[id].remove(); delete lenEls[id]; }
    for (const id in want) {
      const [p, q] = id.split("|");
      if (!PT[p] || !PT[q]) continue;
      if (!lenEls[id]) {
        const el = document.createElement("div");
        layer.appendChild(el);
        lenEls[id] = el;
      }
      lenEls[id].className =
        "glen" + (want[id] === "target" ? " tgt" : "") + (freshKey === id ? " fresh" : "");
      lenEls[id].textContent =
        want[id] === "target" ? "?" : fmtPlain(state.knownLen[id]);
      lenEls[id].dataset.p = p;
      lenEls[id].dataset.q = q;
    }
  }
  const clearLens = () => {
    for (const k in lenEls) { lenEls[k].remove(); delete lenEls[k]; }
  };

  /* ---- camera + input ---- */
  function applyOrbit() {
    const t = (orbit.theta * Math.PI) / 180, p = (orbit.phi * Math.PI) / 180;
    const d = orbit.dist * zoomMul;
    camera.position
      .set(d * Math.cos(p) * Math.cos(t), d * Math.cos(p) * Math.sin(t), d * Math.sin(p))
      .add(orbit.target);
    camera.lookAt(orbit.target);
  }
  const ptrs = new Map<number, [number, number]>();
  let lx = 0, ly = 0, pd = 0;
  const d2 = () => {
    const a = [...ptrs.values()];
    return Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) || 1;
  };
  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest(".gpin")) return;
    stage.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) { lx = e.clientX; ly = e.clientY; } else if (ptrs.size === 2) pd = d2();
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
      if (pd) zoomMul = Math.max(0.55, Math.min(2.2, (zoomMul * pd) / d));
      pd = d;
    }
  };
  const onUp = (e: PointerEvent) => ptrs.delete(e.pointerId);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    zoomMul = Math.max(0.55, Math.min(2.2, zoomMul * (1 + Math.sign(e.deltaY) * 0.1)));
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
    // The dock covers the bottom of the stage, so the figure is nudged up
    // into the space above it rather than sitting behind the controls.
    const dock = stage.parentElement?.querySelector<HTMLElement>("[data-dock]");
    const shift = dock ? Math.min(dock.offsetHeight * 0.85, h * 0.34) : 0;
    camera.aspect = w / h;
    camera.setViewOffset(w, h + shift, 0, shift, w, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  const _v = new THREE.Vector3();
  let raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    if (spin) orbit.theta -= 0.09;
    applyOrbit();
    renderer.render(scene, camera);
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const id in lenEls) {
      const el = lenEls[id], p = el.dataset.p!, q = el.dataset.q!;
      if (!PT[p] || !PT[q]) continue;
      _v.set((PT[p][0] + PT[q][0]) / 2, (PT[p][1] + PT[q][1]) / 2, (PT[p][2] + PT[q][2]) / 2)
        .project(camera);
      el.style.left = (_v.x * 0.5 + 0.5) * w + "px";
      el.style.top = (-_v.y * 0.5 + 0.5) * h + "px";
      el.style.opacity = _v.z > 1 ? "0" : "1";
    }
    for (const k in pinEls) {
      if (!PT[k]) continue;
      _v.set(PT[k][0], PT[k][1], PT[k][2]).project(camera);
      pinEls[k].style.left = (_v.x * 0.5 + 0.5) * w + "px";
      pinEls[k].style.top = (-_v.y * 0.5 + 0.5) * h + "px";
    }
  }

  function load(level: Level, state: GameState) {
    LV = level;
    PT = state.PT;
    clearPins(); clearLens();
    // Each solid reads best from its own angle.
    if (level.kind === "pyramid") {
      orbit.theta = -62; orbit.phi = 17; orbit.dist = 38; orbit.target.set(0, 0, 2.5);
    } else if (level.kind === "box") {
      orbit.theta = -58; orbit.phi = 17; orbit.dist = 54; orbit.target.set(6, 8, 7);
    } else {
      orbit.theta = -64; orbit.phi = 20; orbit.dist = 17; orbit.target.set(2.5, 1.2, 0.7);
    }
    zoomMul = 1;
    spin = true;
    buildStructure();
    resize();
  }

  function update(
    state: GameState, picks: readonly string[], solved: boolean,
    freshKey: string | null, target: readonly [string, string],
  ) {
    PT = state.PT;
    redrawSegments(state, solved, target);
    syncPins(state.ORDER, picks);
    syncLens(state, freshKey, target);
  }

  resize();
  applyOrbit();
  tick();

  return {
    load, update, resize,
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("wheel", onWheel);
      clearPins(); clearLens();
      clearG(structG); clearG(segLayer);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
