import * as THREE from "three";

/**
 * The cuboid explainer's 3D world, ported from legacy/cuboid.html.
 *
 * Deliberately framework-agnostic: it owns its canvas, its own requestAnimation
 * loop and its own DOM label overlay, exactly as the original did. React mounts
 * it once and then pushes plain data in through `update()`. Keeping the
 * geometry maths untouched is the point — this is a stack migration, not a
 * rewrite of the lesson.
 *
 * The original also built `lpG`, `dsG`, `freeG` and `fatLine`, which no beat
 * ever made visible. Those are not ported.
 */

/* ============================================================
   live dimensions
   ============================================================ */

export type Dims = { L: number; W: number; H: number };
export type Solid = "box" | "pyr";
export type FaceKind = "base" | "lateral" | "diagonal" | "tilted";
/** The pyramid names its sections differently from the box. */
export type PyrFaceKind = "base" | "lateral" | "apo" | "diag";
export type DiagLabelKey = "face" | "space" | "vert" | "ang";

export const MAXD = 8;
const CAP = MAXD * MAXD * MAXD;
const RSEG = 0.055;
const COL = { a: 0xe8442a, b: 0x2b4fe8, c: 0xe39a22 } as const;
const CSS = { a: "#E8442A", b: "#2340C4", c: "#9A6614" } as const;

export const surfaceArea = (d: Dims) => 2 * (d.L * d.W + d.L * d.H + d.W * d.H);
export const volume = (d: Dims) => d.L * d.W * d.H;
export const faceDiag = (d: Dims) => Math.sqrt(d.L * d.L + d.W * d.W);
export const spaceDiag = (d: Dims) => Math.sqrt(d.L * d.L + d.W * d.W + d.H * d.H);
export const diagAngle = (d: Dims) => (Math.atan2(d.H, faceDiag(d)) * 180) / Math.PI;
export const projPhi = (d: Dims) =>
  (Math.acos(d.W / Math.hypot(d.W, d.H)) * 180) / Math.PI;

/** Integers print bare, everything else to 2dp — the original's `nice()`. */
export const nice = (x: number) =>
  Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(2);

/**
 * Angle between line `a` and the oblique AM, in degrees — the second readout
 * in the three-perpendiculars beat. Pure: depends only on the dimensions and
 * how far `a` has been turned, so the panel can compute it without the scene.
 */
export function tppOblAngle(d: Dims, tppTheta: number): number {
  const Hh = [-d.L / 2, -d.W / 2, 0];
  const Ap = [-d.L / 2, -d.W / 2, d.H];
  const M = [-d.L / 2 + d.L * 0.62, -d.W / 2 + d.W * 0.55, 0];
  const dd = [M[0] - Hh[0], M[1] - Hh[1]];
  const dl = Math.hypot(dd[0], dd[1]) || 1;
  const th = (tppTheta * Math.PI) / 180;
  const u = [
    (dd[0] * Math.cos(th) - dd[1] * Math.sin(th)) / dl,
    (dd[0] * Math.sin(th) + dd[1] * Math.cos(th)) / dl,
    0,
  ];
  const o = [Ap[0] - M[0], Ap[1] - M[1], Ap[2] - M[2]];
  const dot = u[0] * o[0] + u[1] * o[1] + u[2] * o[2];
  return (
    (Math.acos(Math.max(-1, Math.min(1, dot / Math.hypot(o[0], o[1], o[2])))) * 180) /
    Math.PI
  );
}

/* ---- pyramid measures: base l x w, apex above the centre at h ---- */

/** Apothem onto a base edge of length L (the slant height of that face). */
export const apoLW = (d: Dims) => Math.hypot(d.W / 2, d.H);
/** Apothem onto a base edge of length W. */
export const apoWH = (d: Dims) => Math.hypot(d.L / 2, d.H);
/** Half the base diagonal — the horizontal run of a lateral edge. */
export const halfDiag = (d: Dims) => Math.hypot(d.L / 2, d.W / 2);
/** Corner to apex. Not the same as the apothem, which is the classic slip. */
export const lateralEdge = (d: Dims) => Math.hypot(halfDiag(d), d.H);

export const pyrLateralArea = (d: Dims) => d.L * apoLW(d) + d.W * apoWH(d);
export const pyrSurfaceArea = (d: Dims) => d.L * d.W + pyrLateralArea(d);
export const pyrVolume = (d: Dims) => (d.L * d.W * d.H) / 3;

export const soloLen = () => Math.hypot(3.2, 1.9);
export const soloAngle = (soloH: number) =>
  (Math.atan2(soloH, soloLen()) * 180) / Math.PI;

/* ============================================================
   what a beat asks the scene to show
   ============================================================ */

export type SceneGroups = {
  /** Whether the chosen solid is drawn at all — the two abstract beats hide both. */
  solidVisible: boolean;
  /** The containing box wireframe, used to argue the pyramid is a third of it. */
  third: boolean;
  diag: boolean;
  tri: boolean;
  highlight: boolean;
  tpp: boolean;
  prj: boolean;
  solo: boolean;
  par: boolean;
  cri: boolean;
  doubled: boolean;
};

export type SceneLabels = {
  dims: boolean;
  areas: boolean;
  diag: DiagLabelKey[];
  tpp: boolean;
  solo: boolean;
};

export type SceneParams = {
  dims: Dims;
  /** Eased toward. 0 = folded, 1 = flat. */
  unfold: number;
  /** Eased toward. 0 = solid, 1 = glass. */
  glass: number;
  /** Eased toward. Number of unit cubes shown. */
  fill: number;
  groups: SceneGroups;
  labels: SceneLabels;
  /** Which solid the learner is looking at. Persists across beats. */
  solid: Solid;
  faceKind: FaceKind;
  pyrFaceKind: PyrFaceKind;
  tppTheta: number;
  soloH: number;
  parT: number;
  criAng: number;
  /** The Pythagoras beat hides the angle arc and the base right-angle mark. */
  showArc: boolean;
  showMarkBase: boolean;
  /** The shadow beat drops the dihedral arc and argues from areas instead. */
  showPrjArc: boolean;
};

export type ExplainerScene = {
  update: (params: SceneParams) => void;
  /** Stops the auto-spin — called on first user interaction. */
  stopSpin: () => void;
  resize: () => void;
  dispose: () => void;
};

/* ============================================================
   builders (verbatim from the original, typed)
   ============================================================ */

type FaceGroup = THREE.Group & {
  userData: {
    inner: THREE.Group;
    mat: THREE.MeshLambertMaterial;
    lineMat: THREE.LineBasicMaterial;
  };
};

/** One face: unit plate + unit outline, sized by an inner group. */
function face(color: number): FaceGroup {
  const g = new THREE.Group() as FaceGroup;
  const inner = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
  });
  inner.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat));
  const sq = (
    [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
      [-0.5, -0.5],
    ] as const
  ).map((p) => new THREE.Vector3(p[0], p[1], 0.004));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x14181a,
    transparent: true,
    opacity: 0.55,
  });
  inner.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(sq), lineMat));
  g.add(inner);
  g.userData = { inner, mat, lineMat };
  return g;
}

type Hinge = THREE.Group & { userData: { axis: "x" | "y"; end: number } };

/** A face on a hinge, so the net can fold and unfold. */
function hinged(axis: "x" | "y", end: number, standZ: number, color: number) {
  const pivot = new THREE.Group() as Hinge;
  const f = face(color);
  // three.js Euler order is XYZ (Z applies before X) — compose explicitly as Rz·Rx.
  const m = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  if (standZ) m.premultiply(new THREE.Matrix4().makeRotationZ(standZ));
  f.quaternion.setFromRotationMatrix(m);
  pivot.add(f);
  pivot.userData = { axis, end };
  return { pivot, f };
}

/** Tube-based segment, so thickness is real on every device. */
function seg(color: number, r: number) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, 1, 10, 1, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }),
  );
}

type Vec3 = readonly [number, number, number] | number[];

function place(mesh: THREE.Mesh, a: Vec3, b: Vec3) {
  const A = new THREE.Vector3(a[0], a[1], a[2]);
  const B = new THREE.Vector3(b[0], b[1], b[2]);
  const len = A.distanceTo(B);
  if (len < 1e-6) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.scale.set(1, len, 1);
  mesh.position.copy(A).add(B).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    B.clone().sub(A).normalize(),
  );
}

type Mark = THREE.Group & { userData: { a: THREE.Mesh; b: THREE.Mesh } };

/** The little square that marks a right angle. */
function rightMark(color: number): Mark {
  const g = new THREE.Group() as Mark;
  const a = seg(color, RSEG * 0.6);
  const b = seg(color, RSEG * 0.6);
  g.add(a, b);
  g.userData = { a, b };
  return g;
}

function setMark(mk: Mark, corner: Vec3, u: Vec3, v: Vec3, size: number) {
  const U = new THREE.Vector3(u[0], u[1], u[2]).normalize().multiplyScalar(size);
  const V = new THREE.Vector3(v[0], v[1], v[2]).normalize().multiplyScalar(size);
  const C = new THREE.Vector3(corner[0], corner[1], corner[2]);
  const p1 = C.clone().add(U);
  const p2 = C.clone().add(U).add(V);
  const p3 = C.clone().add(V);
  place(mk.userData.a, p1.toArray(), p2.toArray());
  place(mk.userData.b, p2.toArray(), p3.toArray());
}

function arcPoints(origin: Vec3, d1: Vec3, d2: Vec3, radius: number, N = 26) {
  const O = new THREE.Vector3(origin[0], origin[1], origin[2]);
  const A = new THREE.Vector3(d1[0], d1[1], d1[2]).normalize();
  const B = new THREE.Vector3(d2[0], d2[1], d2[2]).normalize();
  const total = A.angleTo(B);
  const axis = new THREE.Vector3().crossVectors(A, B).normalize();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    pts.push(
      O.clone().add(A.clone().applyAxisAngle(axis, (total * i) / N).multiplyScalar(radius)),
    );
  }
  return pts;
}

function setLinePoints(line: THREE.Line, pts: THREE.Vector3[]) {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}

function quadGeo(mesh: THREE.Mesh, p: Vec3[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        ...p[0], ...p[1], ...p[2],
        ...p[0], ...p[2], ...p[3],
      ],
      3,
    ),
  );
  mesh.geometry.dispose();
  mesh.geometry = g;
}

function gridPoints(size: number, n: number) {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = -size / 2 + (size * i) / n;
    pts.push(-size / 2, t, 0, size / 2, t, 0, t, -size / 2, 0, t, size / 2, 0);
  }
  return pts;
}

/* ============================================================
   the scene
   ============================================================ */

export function createExplainerScene(
  stage: HTMLElement,
  labelBox: HTMLElement,
): ExplainerScene {
  // r128 had no colour management; opting out keeps the original palette
  // rendering exactly as it was authored.
  THREE.ColorManagement.enabled = false;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  stage.insertBefore(renderer.domElement, labelBox);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  camera.up.set(0, 0, 1);
  // Intensities are scaled by PI: three dropped legacy light units in r155,
  // and this restores the original brightness under the new convention.
  scene.add(new THREE.AmbientLight(0xffffff, 0.72 * Math.PI));
  const k1 = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI);
  k1.position.set(7, -10, 14);
  scene.add(k1);
  const k2 = new THREE.DirectionalLight(0xffffff, 0.22 * Math.PI);
  k2.position.set(-8, 6, 4);
  scene.add(k2);
  const world = new THREE.Group();
  scene.add(world);

  /* ---- box faces and the hinged net ---- */
  const base = face(COL.a);
  world.add(base);
  const back = hinged("x", -Math.PI / 2, 0, COL.b);
  const front = hinged("x", Math.PI / 2, 0, COL.b);
  const right = hinged("y", Math.PI / 2, Math.PI / 2, COL.c);
  const left = hinged("y", -Math.PI / 2, Math.PI / 2, COL.c);
  world.add(back.pivot, front.pivot, right.pivot, left.pivot);

  const topPivot = new THREE.Group() as Hinge;
  back.pivot.add(topPivot);
  const topFace = face(COL.a);
  topPivot.add(topFace);
  topPivot.userData = { axis: "x", end: -Math.PI / 2 };

  const HINGES: Hinge[] = [back.pivot, front.pivot, right.pivot, left.pivot, topPivot];

  /* ============================================================
     the pyramid — same three sliders: base L x W, apex above the centre at H
     ============================================================ */

  // Each lateral face is a single triangle whose apex swings about its base
  // edge. The three vertices are rewritten on every frame, so the position
  // attribute is allocated once here and mutated in place — the original
  // built a fresh Float32BufferAttribute per face per frame, which is ~480
  // allocations a second once the RAF loop is running.
  type TriFace = THREE.Group & {
    userData: {
      mat: THREE.MeshLambertMaterial;
      lineMat: THREE.LineBasicMaterial;
      geo: THREE.BufferGeometry;
      pos: THREE.Float32BufferAttribute;
      linePos: THREE.Float32BufferAttribute;
    };
  };

  function triFace(color: number): TriFace {
    const g = new THREE.Group() as TriFace;
    const mat = new THREE.MeshLambertMaterial({
      color, side: THREE.DoubleSide, transparent: true, opacity: 1,
    });
    const geo = new THREE.BufferGeometry();
    const pos = new THREE.Float32BufferAttribute(new Float32Array(9), 3);
    geo.setAttribute("position", pos);
    const mesh = new THREE.Mesh(geo, mat);
    // The geometry is rewritten every frame, so its bounding sphere goes
    // stale immediately; skip culling rather than recomputing it per frame.
    mesh.frustumCulled = false;
    g.add(mesh);

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x2a3634, transparent: true, opacity: 0.5,
    });
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new THREE.Float32BufferAttribute(new Float32Array(12), 3);
    lineGeo.setAttribute("position", linePos);
    const line = new THREE.Line(lineGeo, lineMat);
    line.frustumCulled = false;
    g.add(line);

    g.userData = { mat, lineMat, geo, pos, linePos };
    return g;
  }

  const pyrG = new THREE.Group();
  pyrG.visible = false;
  world.add(pyrG);
  const pyrBase = face(0xe0b36a);
  pyrG.add(pyrBase);
  const pyrSides: TriFace[] = [];
  for (let i = 0; i < 4; i++) {
    const f = triFace(i % 2 ? 0x9ab6e8 : 0x8fa9e0);
    pyrG.add(f);
    pyrSides.push(f);
  }
  const pyrApexDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0x6d5bd0 }),
  );
  pyrG.add(pyrApexDot);

  /* the box that contains it — used to show why the volume is a third */
  const thirdG = new THREE.Group();
  thirdG.visible = false;
  world.add(thirdG);
  const thirdWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: 0x6d5bd0, transparent: true, opacity: 0.85 }),
  );
  thirdG.add(thirdWire);

  /* the doubled pyramid, drawn as an outline around the original */
  const dblPyr = new THREE.Group();
  dblPyr.visible = false;
  world.add(dblPyr);
  const dblPyrPos = new THREE.Float32BufferAttribute(new Float32Array(8 * 2 * 3), 3);
  const dblPyrGeo = new THREE.BufferGeometry();
  dblPyrGeo.setAttribute("position", dblPyrPos);
  const dblPyrLines = new THREE.LineSegments(
    dblPyrGeo,
    new THREE.LineBasicMaterial({ color: 0x6d5bd0, transparent: true, opacity: 0.9 }),
  );
  dblPyrLines.frustumCulled = false;
  dblPyr.add(dblPyrLines);

  function layoutDblPyr() {
    const { L, W, H } = D;
    const A = [-L, -W, 0], B = [L, -W, 0], C = [L, W, 0], Dd = [-L, W, 0];
    const S = [0, 0, 2 * H];
    const edges = [
      [A, B], [B, C], [C, Dd], [Dd, A],
      [A, S], [B, S], [C, S], [Dd, S],
    ];
    const arr = dblPyrPos.array as Float32Array;
    let i = 0;
    for (const [a, b] of edges) {
      arr[i++] = a[0]; arr[i++] = a[1]; arr[i++] = a[2];
      arr[i++] = b[0]; arr[i++] = b[1]; arr[i++] = b[2];
    }
    dblPyrPos.needsUpdate = true;
  }

  const pyrPts = () => {
    const { L, W, H } = D;
    return {
      A: [-L / 2, -W / 2, 0], B: [L / 2, -W / 2, 0],
      C: [L / 2, W / 2, 0], D: [-L / 2, W / 2, 0],
      O: [0, 0, 0], S: [0, 0, H],
    };
  };

  /**
   * Folds the pyramid. `unfold` matches the box convention — 0 closed,
   * 1 flat net — and the inversion the original did at the call site
   * (`layoutPyramid(1 - t)`) is folded in here instead.
   */
  function layoutPyramid(unfoldT: number) {
    const { L, W, H } = D;
    const P = pyrPts();
    pyrBase.userData.inner.scale.set(L, W, 1);
    pyrBase.position.set(0, 0, 0);

    const t = 1 - unfoldT;
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Each face swings about its base edge; the apex rides a circle whose
    // radius is that face's apothem.
    const edges: { a: number[]; b: number[]; out: number[]; half: number }[] = [
      { a: P.A, b: P.B, out: [0, -1, 0], half: W / 2 },
      { a: P.B, b: P.C, out: [1, 0, 0], half: L / 2 },
      { a: P.C, b: P.D, out: [0, 1, 0], half: W / 2 },
      { a: P.D, b: P.A, out: [-1, 0, 0], half: L / 2 },
    ];

    edges.forEach((ed, i) => {
      const f = pyrSides[i];
      const mid = [(ed.a[0] + ed.b[0]) / 2, (ed.a[1] + ed.b[1]) / 2, 0];
      const ap = Math.hypot(ed.half, H);
      const flat = Math.PI, fold = Math.atan2(H, ed.half);
      const phi = flat + (fold - flat) * e;
      const apex = [
        mid[0] - ap * Math.cos(phi) * ed.out[0],
        mid[1] - ap * Math.cos(phi) * ed.out[1],
        ap * Math.sin(phi),
      ];

      const q = f.userData.pos.array as Float32Array;
      q[0] = ed.a[0]; q[1] = ed.a[1]; q[2] = ed.a[2];
      q[3] = ed.b[0]; q[4] = ed.b[1]; q[5] = ed.b[2];
      q[6] = apex[0]; q[7] = apex[1]; q[8] = apex[2];
      f.userData.pos.needsUpdate = true;
      f.userData.geo.computeVertexNormals();

      // Outline, lifted a hair so it reads over the fill.
      const l = f.userData.linePos.array as Float32Array;
      l[0] = ed.a[0]; l[1] = ed.a[1]; l[2] = ed.a[2] + 0.006;
      l[3] = ed.b[0]; l[4] = ed.b[1]; l[5] = ed.b[2] + 0.006;
      l[6] = apex[0]; l[7] = apex[1]; l[8] = apex[2] + 0.006;
      l[9] = ed.a[0]; l[10] = ed.a[1]; l[11] = ed.a[2] + 0.006;
      f.userData.linePos.needsUpdate = true;
    });

    pyrApexDot.position.set(0, 0, H);
    pyrApexDot.visible = e > 0.985;
    thirdWire.scale.set(L, W, H);
    thirdWire.position.set(0, 0, H / 2);
  }


  let D: Dims = { L: 6, W: 4, H: 3 };
  let solid: Solid = "box";

  const FACES: {
    g: FaceGroup;
    pair: keyof typeof CSS;
    dims: () => [number, number];
    label: HTMLDivElement;
  }[] = [
    { g: base, pair: "a", dims: () => [D.L, D.W], label: mkLabel("area") },
    { g: topFace, pair: "a", dims: () => [D.L, D.W], label: mkLabel("area") },
    { g: back.f, pair: "b", dims: () => [D.L, D.H], label: mkLabel("area") },
    { g: front.f, pair: "b", dims: () => [D.L, D.H], label: mkLabel("area") },
    { g: right.f, pair: "c", dims: () => [D.W, D.H], label: mkLabel("area") },
    { g: left.f, pair: "c", dims: () => [D.W, D.H], label: mkLabel("area") },
  ];
  FACES.forEach((f) => (f.label.style.color = CSS[f.pair]));

  /* ---- unit cubes ---- */
  const cubes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.86, 0.86, 0.86),
    new THREE.MeshLambertMaterial({ color: 0xcbd6ee }),
    CAP,
  );
  cubes.count = 0;
  world.add(cubes);
  const dummy = new THREE.Object3D();
  function layoutCubes() {
    let i = 0;
    for (let z = 0; z < D.H; z++)
      for (let y = 0; y < D.W; y++)
        for (let x = 0; x < D.L; x++) {
          dummy.position.set(-D.L / 2 + x + 0.5, -D.W / 2 + y + 0.5, z + 0.5);
          dummy.updateMatrix();
          cubes.setMatrixAt(i++, dummy.matrix);
        }
    cubes.instanceMatrix.needsUpdate = true;
  }

  /* ---- diagonals, marks, angle arc ---- */
  const diagG = new THREE.Group();
  diagG.visible = false;
  world.add(diagG);
  const segFace = seg(0x5fb0a6, RSEG);
  const segSpace = seg(0xe8b84b, RSEG * 1.15);
  const segVert = seg(0xe27a5f, RSEG);
  diagG.add(segFace, segSpace, segVert);
  const markBase = rightMark(0x14181a);
  const markVert = rightMark(0x14181a);
  diagG.add(markBase, markVert);
  const arc = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xe8b84b, transparent: true, opacity: 0.95 }),
  );
  diagG.add(arc);

  const cA = () => [-D.L / 2, -D.W / 2, 0];
  const cB = () => [D.L / 2, -D.W / 2, 0];
  const cC = () => [D.L / 2, D.W / 2, 0];
  const cC1 = () => [D.L / 2, D.W / 2, D.H];

  function layoutDiagonals() {
    const A = cA(), C = cC(), C1 = cC1(), B = cB();
    place(segFace, A, C);
    place(segSpace, A, C1);
    place(segVert, C, C1);
    setMark(markBase, B, [-1, 0, 0], [0, 1, 0], Math.min(D.L, D.W) * 0.22 + 0.25);
    setMark(
      markVert, C, [A[0] - C[0], A[1] - C[1], 0], [0, 0, 1],
      Math.min(Math.hypot(D.L, D.W), D.H) * 0.16 + 0.25,
    );
    setLinePoints(
      arc,
      arcPoints(
        A,
        [C[0] - A[0], C[1] - A[1], 0],
        [C1[0] - A[0], C1[1] - A[1], C1[2] - A[2]],
        Math.hypot(D.L, D.W) * 0.32 + 0.4,
      ),
    );
    setTri(A, C, C1);
  }

  /* ---- the isolated right triangle, as a filled plate ---- */
  const triG = new THREE.Group();
  triG.visible = false;
  world.add(triG);
  const triFill = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: 0xe8b84b, transparent: true, opacity: 0.13, side: THREE.DoubleSide,
    }),
  );
  triG.add(triFill);
  function setTri(p1: Vec3, p2: Vec3, p3: Vec3) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([...p1, ...p2, ...p3], 3),
    );
    triFill.geometry.dispose();
    triFill.geometry = g;
  }

  /* ---- highlight a named face / section ---- */
  const hlG = new THREE.Group();
  hlG.visible = false;
  world.add(hlG);
  const hlFill = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: 0xe8b84b, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
    }),
  );
  hlG.add(hlFill);
  const hlEdges: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 1, 10),
      new THREE.MeshBasicMaterial({ color: 0xe8b84b }),
    );
    m.visible = false;
    hlG.add(m);
    hlEdges.push(m);
  }

  /** The box corners, named the way problems name them. */
  function corner(k: string): number[] {
    const { L, W, H } = D, x = L / 2, y = W / 2;
    return {
      A: [-x, -y, 0], B: [x, -y, 0], C: [x, y, 0], D: [-x, y, 0],
      A1: [-x, -y, H], B1: [x, -y, H], C1: [x, y, H], D1: [-x, y, H],
    }[k]!;
  }

  const FACE_PTS: Record<FaceKind, { pts: string[]; col: number }> = {
    base: { pts: ["A", "B", "C", "D"], col: 0xe8b84b },
    lateral: { pts: ["A", "B", "B1", "A1"], col: 0x5fb0a6 },
    diagonal: { pts: ["A", "C", "C1", "A1"], col: 0xe27a5f },
    tilted: { pts: ["A", "B", "C1", "D1"], col: 0xb88be0 },
  };

  /** Paints one highlighted quad + its four edges. A triangle is passed as a
   *  quad with its last point repeated, which is how the pyramid sections
   *  reuse this. */
  function showQuad(pts: number[][], col: number) {
    quadGeo(hlFill, pts);
    hlFill.material.color.setHex(col);
    hlEdges.forEach((m) => (m.visible = false));
    for (let i = 0; i < 4; i++) {
      const A = new THREE.Vector3(...(pts[i] as [number, number, number]));
      const B = new THREE.Vector3(...(pts[(i + 1) % 4] as [number, number, number]));
      const len = A.distanceTo(B);
      const m = hlEdges[i];
      if (len < 1e-6) { m.visible = false; continue; }
      m.visible = true;
      m.scale.set(1, len, 1);
      m.position.copy(A).add(B).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize(),
      );
      (m.material as THREE.MeshBasicMaterial).color.setHex(col);
    }
    hlG.visible = true;
  }

  function setFace(kind: FaceKind) {
    const { pts: names, col } = FACE_PTS[kind];
    showQuad(names.map(corner), col);
  }

  /* The pyramid names its sections differently, so it gets its own set.
     'apo' and 'diag' are cuts rather than faces; both are triangles, passed
     with the apex repeated so showQuad can treat them as degenerate quads. */
  const PYR_FACE_PTS: Record<PyrFaceKind, { pts: string[]; col: number; tri: boolean }> = {
    base: { pts: ["A", "B", "C", "D"], col: 0x6d5bd0, tri: false },
    lateral: { pts: ["A", "B", "S"], col: 0x17c2b4, tri: true },
    apo: { pts: ["M1", "M2", "S", "S"], col: 0xe39a22, tri: false },
    diag: { pts: ["A", "C", "S", "S"], col: 0xe8442a, tri: false },
  };

  function pyrPoint(k: string): number[] {
    if (k === "M1") return [0, -D.W / 2, 0];
    if (k === "M2") return [0, D.W / 2, 0];
    return pyrPts()[k as keyof ReturnType<typeof pyrPts>];
  }

  function setPyrFace(kind: PyrFaceKind) {
    const { pts: names, col, tri } = PYR_FACE_PTS[kind];
    const q = names.map(pyrPoint);
    showQuad(tri ? [q[0], q[1], q[2], q[2]] : q, col);
  }

  /* ---- theorem of three perpendiculars ---- */
  const tppG = new THREE.Group();
  tppG.visible = false;
  world.add(tppG);
  const tPerp = seg(0xe27a5f, 0.055);
  const tObl = seg(0xe8b84b, 0.062);
  const tProj = seg(0x5fb0a6, 0.062);
  const tLine = seg(0x14181a, 0.062);
  tppG.add(tPerp, tObl, tProj, tLine);
  const mkH = rightMark(0xe27a5f);
  const mkP = rightMark(0x5fb0a6);
  const mkO = rightMark(0xe8b84b);
  tppG.add(mkH, mkP, mkO);
  const dotGeo = new THREE.SphereGeometry(0.13, 14, 10);
  const mkDot = (c: number) => new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: c }));
  const dotA = mkDot(0x14181a), dotH = mkDot(0x14181a), dotM = mkDot(0x14181a);
  tppG.add(dotA, dotH, dotM);
  const planeTint = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x5fb0a6, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
    }),
  );
  tppG.add(planeTint);

  let tppTheta = 90;
  const tppPts = () => {
    const { L, W, H } = D;
    return {
      Hh: [-L / 2, -W / 2, 0],
      Ap: [-L / 2, -W / 2, H],
      M: [-L / 2 + L * 0.62, -W / 2 + W * 0.55, 0],
    };
  };
  function tppDir(): number[] {
    const { Hh, M } = tppPts();
    const d = [M[0] - Hh[0], M[1] - Hh[1]];
    const dl = Math.hypot(d[0], d[1]) || 1;
    const th = (tppTheta * Math.PI) / 180;
    return [
      (d[0] * Math.cos(th) - d[1] * Math.sin(th)) / dl,
      (d[0] * Math.sin(th) + d[1] * Math.cos(th)) / dl,
      0,
    ];
  }
  function layoutTPP() {
    const { L, W } = D, { Hh, Ap, M } = tppPts(), u = tppDir();
    place(tPerp, Hh, Ap);
    place(tObl, Ap, M);
    place(tProj, Hh, M);
    const r = Math.max(L, W) * 0.5;
    place(tLine, [M[0] - u[0] * r, M[1] - u[1] * r, 0], [M[0] + u[0] * r, M[1] + u[1] * r, 0]);
    const sz = Math.min(L, W) * 0.15 + 0.28;
    setMark(mkH, Hh, [0, 0, 1], [M[0] - Hh[0], M[1] - Hh[1], 0], sz);
    setMark(mkP, M, u, [Hh[0] - M[0], Hh[1] - M[1], 0], sz);
    setMark(mkO, M, u, [Ap[0] - M[0], Ap[1] - M[1], Ap[2] - M[2]], sz * 1.15);
    dotA.position.set(Ap[0], Ap[1], Ap[2]);
    dotH.position.set(Hh[0], Hh[1], Hh[2]);
    dotM.position.set(M[0], M[1], M[2]);
    planeTint.scale.set(D.L, D.W, 1);
    planeTint.position.set(0, 0, -0.014);
    // Both marks only appear at exactly 90°, which is the whole point.
    const locked = Math.round(tppTheta) === 90;
    mkP.visible = locked;
    mkO.visible = locked;
  }
  /* ---- standalone plane with a point above it ---- */
  const soloG = new THREE.Group();
  soloG.visible = false;
  world.add(soloG);
  const soloPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x5fb0a6, transparent: true, opacity: 0.13, side: THREE.DoubleSide,
    }),
  );
  soloG.add(soloPlane);
  const soloGrid = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x5fb0a6, transparent: true, opacity: 0.28 }),
  );
  soloGrid.geometry.setAttribute(
    "position", new THREE.Float32BufferAttribute(gridPoints(9, 6), 3),
  );
  soloG.add(soloGrid);
  const sPerp = seg(0xe27a5f, 0.05);
  const sObl = seg(0xe8b84b, 0.06);
  const sProj = seg(0x5fb0a6, 0.06);
  soloG.add(sPerp, sObl, sProj);
  const sMarkH = rightMark(0xe27a5f);
  soloG.add(sMarkH);
  const sArc = new THREE.Line(
    new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe8b84b }),
  );
  soloG.add(sArc);
  const sA = mkDot(0x14181a), sH = mkDot(0x14181a), sM = mkDot(0x14181a);
  soloG.add(sA, sH, sM);

  let soloH = 4;
  const soloPts = () => ({ H: [0, 0, 0], A: [0, 0, soloH], M: [3.2, 1.9, 0] });
  function layoutSolo() {
    const { H, A, M } = soloPts();
    place(sPerp, H, A);
    place(sObl, A, M);
    place(sProj, H, M);
    setMark(sMarkH, H, [0, 0, 1], [M[0] - H[0], M[1] - H[1], 0], 0.45);
    sA.position.set(A[0], A[1], A[2]);
    sH.position.set(H[0], H[1], H[2]);
    sM.position.set(M[0], M[1], M[2]);
    soloPlane.scale.set(9, 9, 1);
    soloPlane.position.set(0, 0, -0.015);
    // Arc at M, between MH (the projection) and MA (the oblique).
    setLinePoints(
      sArc,
      arcPoints(
        M,
        [H[0] - M[0], H[1] - M[1], 0],
        [A[0] - M[0], A[1] - M[1], A[2] - M[2]],
        1.15, 24,
      ),
    );
  }

  /* ---- parallel translation ---- */
  const parG = new THREE.Group();
  parG.visible = false;
  world.add(parG);
  const pOrig = seg(0xe8b84b, 0.07);
  const pCopy = seg(0x5fb0a6, 0.07);
  parG.add(pOrig, pCopy);
  const pRail: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const m = seg(0x93a09a, 0.022);
    parG.add(m);
    pRail.push(m);
  }
  let parT = 0;
  function layoutPar() {
    const { L, W, H } = D;
    const a = [-L / 2, -W / 2, 0], b = [-L / 2, -W / 2, H];
    const dx = L * parT;
    const a2 = [a[0] + dx, a[1], a[2]], b2 = [b[0] + dx, b[1], b[2]];
    place(pOrig, a, b);
    place(pCopy, a2, b2);
    place(pRail[0], a, a2);
    place(pRail[1], b, b2);
    pRail.forEach((r) => (r.visible = parT > 0.02));
  }

  /* ---- line perpendicular to a plane: two lines are enough ---- */
  const criG = new THREE.Group();
  criG.visible = false;
  world.add(criG);
  const cVert = seg(0xe27a5f, 0.06);
  const cL1 = seg(0x5fb0a6, 0.055);
  const cL2 = seg(0x5fb0a6, 0.055);
  const cTest = seg(0xe8b84b, 0.055);
  criG.add(cVert, cL1, cL2, cTest);
  const cM1 = rightMark(0x5fb0a6), cM2 = rightMark(0x5fb0a6), cMT = rightMark(0xe8b84b);
  criG.add(cM1, cM2, cMT);
  const criPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: 0x5fb0a6, transparent: true, opacity: 0.12, side: THREE.DoubleSide,
    }),
  );
  criG.add(criPlane);
  const criGrid = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x5fb0a6, transparent: true, opacity: 0.26 }),
  );
  criGrid.geometry.setAttribute(
    "position", new THREE.Float32BufferAttribute(gridPoints(9, 6), 3),
  );
  criG.add(criGrid);
  let criAng = 25;
  function layoutCri() {
    const O = [0, 0, 0], R = 3.4;
    place(cVert, O, [0, 0, 4.2]);
    place(cL1, [-R, 0, 0], [R, 0, 0]);
    const d2 = [Math.cos(1.15), Math.sin(1.15), 0];
    place(cL2, [-d2[0] * R, -d2[1] * R, 0], [d2[0] * R, d2[1] * R, 0]);
    const th = (criAng * Math.PI) / 180;
    const u = [Math.cos(th), Math.sin(th), 0];
    place(cTest, [-u[0] * R, -u[1] * R, 0], [u[0] * R, u[1] * R, 0]);
    setMark(cM1, O, [1, 0, 0], [0, 0, 1], 0.44);
    setMark(cM2, O, d2, [0, 0, 1], 0.44);
    setMark(cMT, O, u, [0, 0, 1], 0.52);
    criPlane.scale.set(9, 9, 1);
    criPlane.position.set(0, 0, -0.015);
  }

  /* ---- projected area: a tilted cut and its shadow ---- */
  const prjG = new THREE.Group();
  prjG.visible = false;
  world.add(prjG);
  const plate = (color: number, op: number) =>
    new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: op, side: THREE.DoubleSide,
      }),
    );
  const prjTilt = plate(0xb88be0, 0.34);
  const prjShad = plate(0x5fb0a6, 0.3);
  prjG.add(prjTilt, prjShad);
  const prjEdges: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const m = seg(0xb88be0, 0.05);
    prjG.add(m);
    prjEdges.push(m);
  }
  const prjArc = new THREE.Line(
    new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xe8b84b }),
  );
  prjG.add(prjArc);
  function layoutPrj() {
    const { L, W, H } = D, x = L / 2, y = W / 2;
    const A = [-x, -y, 0], B = [x, -y, 0], C = [x, y, 0], Dd = [-x, y, 0];
    const C1 = [x, y, H], D1 = [-x, y, H];
    quadGeo(prjTilt, [A, B, C1, D1]);
    quadGeo(prjShad, [A, B, C, Dd]);
    const tp = [A, B, C1, D1], sp = [A, B, C, Dd];
    for (let i = 0; i < 4; i++) {
      place(prjEdges[i], tp[i], tp[(i + 1) % 4]);
      (prjEdges[i].material as THREE.MeshBasicMaterial).color.setHex(0xb88be0);
      place(prjEdges[4 + i], sp[i], sp[(i + 1) % 4]);
      (prjEdges[4 + i].material as THREE.MeshBasicMaterial).color.setHex(0x5fb0a6);
    }
    // Dihedral angle along AB, drawn at A between AD (base) and AD1 (tilted).
    setLinePoints(
      prjArc,
      arcPoints(A, [0, W, 0], [0, W, H], Math.min(W, H) * 0.45 + 0.35, 24),
    );
  }

  /* ---- doubling ---- */
  const dbl = new THREE.Group();
  dbl.visible = false;
  world.add(dbl);
  const bigWire = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color: 0xe8b84b, transparent: true, opacity: 0.9 }),
  );
  dbl.add(bigWire);
  const ghosts: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const gg = new THREE.Group();
    gg.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshLambertMaterial({ color: 0x5fb0a6, transparent: true, opacity: 0.16 }),
      ),
    );
    gg.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
        new THREE.LineBasicMaterial({ color: 0x14181a, transparent: true, opacity: 0.3 }),
      ),
    );
    dbl.add(gg);
    ghosts.push(gg);
  }
  function layoutDouble() {
    const { L, W, H } = D;
    bigWire.scale.set(2 * L, 2 * W, 2 * H);
    bigWire.position.set(L / 2, W / 2, H);
    let n = 0;
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++)
        for (let k = 0; k < 2; k++) {
          const gg = ghosts[n++];
          gg.scale.set(L, W, H);
          gg.position.set(i * L, j * W, H / 2 + k * H);
          gg.visible = !(i === 0 && j === 0 && k === 0);
        }
  }

  /* ============================================================
     labels
     ============================================================ */
  function mkLabel(cls: string) {
    const el = document.createElement("div");
    el.className = "lab " + cls + " hide";
    labelBox.appendChild(el);
    return el;
  }
  const dimLabels = [
    { el: mkLabel("dim"), get: () => D.L, pos: () => [0, -D.W / 2 - 0.95, -0.5] },
    { el: mkLabel("dim"), get: () => D.W, pos: () => [D.L / 2 + 0.95, 0, -0.5] },
    {
      el: mkLabel("dim"),
      get: () => D.H,
      // The pyramid has no vertical edge to hang this off, so it rides the axis.
      pos: () =>
        solid === "pyr" ? [0.55, 0, D.H / 2] : [D.L / 2 + 0.7, -D.W / 2 - 0.7, D.H / 2],
    },
  ];
  const dLab: Record<DiagLabelKey, HTMLDivElement> = {
    face: mkLabel("area"), space: mkLabel("area"),
    vert: mkLabel("area"), ang: mkLabel("area"),
  };
  dLab.face.style.color = "#5FB0A6";
  dLab.space.style.color = "#E8B84B";
  dLab.vert.style.color = "#E27A5F";
  dLab.ang.style.color = "#E8B84B";
  const tLab = { A: mkLabel("dim"), H: mkLabel("dim"), M: mkLabel("dim"), a: mkLabel("dim") };
  tLab.A.textContent = "A"; tLab.H.textContent = "H";
  tLab.M.textContent = "M"; tLab.a.textContent = "a";
  const sLab = { A: mkLabel("dim"), H: mkLabel("dim"), M: mkLabel("dim") };
  sLab.A.textContent = "A"; sLab.H.textContent = "H"; sLab.M.textContent = "M";

  function refreshLabelText() {
    dimLabels.forEach((d) => (d.el.textContent = String(d.get())));
    FACES.forEach((f) => {
      const [a, b] = f.dims();
      f.label.textContent = `${a} × ${b} = ${a * b}`;
    });
  }

  const _v = new THREE.Vector3();
  const project = (p: number[], w: number, h: number) => {
    _v.set(p[0], p[1], p[2]).project(camera);
    return [(_v.x * 0.5 + 0.5) * w, (-_v.y * 0.5 + 0.5) * h];
  };
  const put = (el: HTMLElement, p: number[], w: number, h: number, dx = 0, dy = 0) => {
    const [x, y] = project(p, w, h);
    el.style.left = x + dx + "px";
    el.style.top = y + dy + "px";
  };

  function updateLabels() {
    const w = stage.clientWidth, h = stage.clientHeight;
    for (const d of dimLabels) put(d.el, d.pos(), w, h);
    for (const f of FACES) {
      f.g.getWorldPosition(_v);
      _v.project(camera);
      f.label.style.left = (_v.x * 0.5 + 0.5) * w + "px";
      f.label.style.top = (-_v.y * 0.5 + 0.5) * h + "px";
    }

    if (diagG.visible) {
      dLab.face.textContent = nice(faceDiag(D));
      dLab.space.textContent = nice(spaceDiag(D));
      dLab.vert.textContent = String(D.H);
      dLab.ang.textContent = diagAngle(D).toFixed(1) + "°";
      const A = cA(), C = cC(), C1 = cC1();
      const mid = (a: number[], b: number[]) =>
        [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      put(dLab.face, mid(A, C), w, h);
      put(dLab.space, mid(A, C1), w, h);
      put(dLab.vert, mid(C, C1), w, h);
      const dir = [C[0] - A[0], C[1] - A[1], 0];
      const L2 = Math.hypot(dir[0], dir[1]) || 1;
      const rr = Math.hypot(D.L, D.W) * 0.32 + 0.4;
      put(dLab.ang, [A[0] + (dir[0] / L2) * rr * 1.25, A[1] + (dir[1] / L2) * rr * 1.25, D.H * 0.12 + 0.25], w, h);
    }

    if (tppG.visible) {
      const { Hh, Ap, M } = tppPts();
      put(tLab.A, Ap, w, h, 0, -20);
      put(tLab.H, Hh, w, h, -16, 14);
      put(tLab.M, M, w, h, 10, 16);
      const u = tppDir();
      const r = Math.max(D.L, D.W) * 0.5;
      put(tLab.a, [M[0] + u[0] * r, M[1] + u[1] * r, 0], w, h, 14, 0);
    }

    if (soloG.visible) {
      const { H, A, M } = soloPts();
      put(sLab.A, A, w, h, 0, -20);
      put(sLab.H, H, w, h, -16, 16);
      put(sLab.M, M, w, h, 16, 10);
    }
  }

  /* ============================================================
     dimensions
     ============================================================ */
  function setDims() {
    const { L, W, H } = D;
    base.userData.inner.scale.set(L, W, 1);
    topFace.userData.inner.scale.set(L, W, 1);
    back.f.userData.inner.scale.set(L, H, 1);
    front.f.userData.inner.scale.set(L, H, 1);
    right.f.userData.inner.scale.set(W, H, 1);
    left.f.userData.inner.scale.set(W, H, 1);
    back.pivot.position.set(0, W / 2, 0);
    front.pivot.position.set(0, -W / 2, 0);
    right.pivot.position.set(L / 2, 0, 0);
    left.pivot.position.set(-L / 2, 0, 0);
    [back, front, right, left].forEach((w) => w.f.position.set(0, 0, H / 2));
    topPivot.position.set(0, 0, H);
    topFace.position.set(0, -W / 2, 0);
    layoutCubes(); layoutDouble(); layoutDblPyr(); layoutDiagonals(); layoutTPP();
    layoutPrj(); layoutSolo(); layoutPar(); layoutCri();
    refreshLabelText();
  }

  /* ============================================================
     animated state
     ============================================================ */
  let unfold = 0, unfoldT = 0, glass = 0, glassT = 0, fill = 0, fillT = 0;
  let doubled = false, autoSpin = true, zoomMul = 1;
  let solidVisible = true;
  const orbit = { theta: -56, phi: 24, dist: 15, target: new THREE.Vector3(0, 0, 1.5) };
  const want = { dist: 15, target: new THREE.Vector3(0, 0, 1.5) };
  const fitDist = (r: number) => (r / Math.sin((20 * Math.PI) / 180)) * 1.18;

  function applyUnfold(t: number) {
    if (solid === "pyr") {
      layoutPyramid(t);
      applyCam(t);
      return;
    }
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    for (const p of HINGES) {
      const a = p.userData.end * e;
      if (p.userData.axis === "x") p.rotation.x = a;
      else p.rotation.y = a;
    }
    applyCam(t);
  }

  /** Frames whichever solid is showing, at whatever stage of unfolding. */
  function applyCam(t: number) {
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const { L, W, H } = D;
    let rSolid: number, rNet: number;
    if (solid === "pyr") {
      rSolid = 0.5 * Math.hypot(L, W) + H * 0.35;
      // Opened out, a pyramid reaches one apothem past each base edge.
      rNet = 0.5 * Math.hypot(L + 2 * apoWH(D), W + 2 * apoLW(D));
    } else {
      rSolid = 0.5 * Math.hypot(L, W, H);
      rNet = 0.5 * Math.hypot(L + 2 * H, 2 * W + 2 * H);
    }
    const r = rSolid + (rNet - rSolid) * e;
    want.dist = fitDist(doubled ? r * 2 : r) * zoomMul;
    want.target.set(
      doubled ? L / 2 : 0,
      // The pyramid net opens symmetrically, so the centre never shifts.
      solid === "pyr" ? 0 : (W / 2) * e + (doubled ? W / 2 : 0),
      solid === "pyr"
        ? (H / 2) * (1 - e) * 0.55
        : (H / 2) * (1 - e) + (doubled ? H / 2 : 0),
    );
  }
  function applyGlass(g: number) {
    FACES.forEach((f) => {
      f.g.userData.mat.opacity = 1 - 0.86 * g;
      f.g.userData.lineMat.opacity = 0.55 + 0.45 * g;
    });
    pyrBase.userData.mat.opacity = 1 - 0.86 * g;
    pyrBase.userData.lineMat.opacity = 0.55 + 0.45 * g;
    pyrSides.forEach((f) => (f.userData.mat.opacity = 1 - 0.86 * g));
  }
  function applyOrbit() {
    const t = (orbit.theta * Math.PI) / 180, p = (orbit.phi * Math.PI) / 180;
    camera.position
      .set(
        orbit.dist * Math.cos(p) * Math.cos(t),
        orbit.dist * Math.cos(p) * Math.sin(t),
        orbit.dist * Math.sin(p),
      )
      .add(orbit.target);
    camera.lookAt(orbit.target);
  }

  /* ============================================================
     input
     ============================================================ */
  const pts = new Map<number, [number, number]>();
  let lx = 0, ly = 0, pd = 0;
  const d2 = () => {
    const a = [...pts.values()];
    return Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) || 1;
  };
  const onDown = (e: PointerEvent) => {
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { lx = e.clientX; ly = e.clientY; }
    else if (pts.size === 2) pd = d2();
    autoSpin = false;
  };
  const onMove = (e: PointerEvent) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) {
      orbit.theta -= (e.clientX - lx) * 0.4;
      orbit.phi = Math.max(-85, Math.min(85, orbit.phi + (e.clientY - ly) * 0.34));
      lx = e.clientX; ly = e.clientY;
    } else if (pts.size === 2) {
      const d = d2();
      if (pd) zoomMul = Math.max(0.5, Math.min(2.4, (zoomMul * pd) / d));
      pd = d;
    }
  };
  const onUp = (e: PointerEvent) => pts.delete(e.pointerId);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    zoomMul = Math.max(0.5, Math.min(2.4, zoomMul * (1 + Math.sign(e.deltaY) * 0.1)));
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

  /* ============================================================
     the loop
     ============================================================ */
  let raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    if (autoSpin) orbit.theta -= 0.11;
    unfold += (unfoldT - unfold) * 0.09;
    glass += (glassT - glass) * 0.11;
    fill += (fillT - fill) * 0.1;
    applyUnfold(unfold);
    applyGlass(glass);
    // Cubes are a box-only device. Guarding here rather than at each call
    // site stops a part-filled box being left inside the pyramid after a
    // toggle, which is what the original did.
    cubes.count = solidVisible && solid === "box" ? Math.round(fill) : 0;
    orbit.dist += (want.dist - orbit.dist) * 0.09;
    orbit.target.lerp(want.target, 0.09);
    applyOrbit();
    renderer.render(scene, camera);
    updateLabels();
  }

  const toggle = (el: HTMLElement, on: boolean) => el.classList.toggle("hide", !on);

  function update(p: SceneParams) {
    const dimsChanged = p.dims.L !== D.L || p.dims.W !== D.W || p.dims.H !== D.H;
    const solidChanged = p.solid !== solid;
    D = p.dims;
    solid = p.solid;
    solidVisible = p.groups.solidVisible;

    unfoldT = p.unfold;
    glassT = p.glass;
    fillT = p.fill;
    doubled = p.groups.doubled;

    if (tppTheta !== p.tppTheta) { tppTheta = p.tppTheta; layoutTPP(); }
    if (soloH !== p.soloH) { soloH = p.soloH; layoutSolo(); }
    if (parT !== p.parT) { parT = p.parT; layoutPar(); }
    if (criAng !== p.criAng) { criAng = p.criAng; layoutCri(); }
    if (dimsChanged) setDims();
    // A toggle re-points visibility and re-frames the camera at the current
    // fold, but deliberately leaves orbit angle, zoom and the eased unfold /
    // glass / fill values alone, so the view does not jump.
    if (solidChanged || dimsChanged) applyUnfold(unfold);

    const showBox = p.groups.solidVisible && solid === "box";
    const showPyr = p.groups.solidVisible && solid === "pyr";
    FACES.forEach((f) => (f.g.visible = showBox));
    HINGES.forEach((h) => (h.visible = showBox));
    base.visible = showBox;
    pyrG.visible = showPyr;
    if (showPyr) layoutPyramid(unfold);
    thirdG.visible = p.groups.third && showPyr;

    diagG.visible = p.groups.diag;
    triG.visible = p.groups.tri;
    hlG.visible = p.groups.highlight;
    tppG.visible = p.groups.tpp;
    prjG.visible = p.groups.prj;
    soloG.visible = p.groups.solo;
    parG.visible = p.groups.par;
    criG.visible = p.groups.cri;
    dbl.visible = p.groups.doubled && solid === "box";
    dblPyr.visible = p.groups.doubled && solid === "pyr";

    if (p.groups.highlight) {
      if (solid === "pyr") setPyrFace(p.pyrFaceKind);
      else setFace(p.faceKind);
    }
    arc.visible = p.showArc;
    markBase.visible = p.showMarkBase;
    prjArc.visible = p.showPrjArc;

    dimLabels.forEach((d) => toggle(d.el, p.labels.dims));
    // Face-area labels are positioned from the box's faces, so they would
    // float over a pyramid as six strays — the original did exactly that.
    FACES.forEach((f) => toggle(f.label, p.labels.areas && showBox));
    (Object.keys(dLab) as DiagLabelKey[]).forEach((k) =>
      toggle(dLab[k], p.labels.diag.includes(k)),
    );
    (["A", "H", "M", "a"] as const).forEach((k) => toggle(tLab[k], p.labels.tpp));
    (["A", "H", "M"] as const).forEach((k) => toggle(sLab[k], p.labels.solo));

    refreshLabelText();
  }

  setDims();
  resize();
  applyOrbit();
  tick();

  return {
    update,
    stopSpin: () => { autoSpin = false; },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("wheel", onWheel);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) mat.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelBox.replaceChildren();
    },
  };
}
