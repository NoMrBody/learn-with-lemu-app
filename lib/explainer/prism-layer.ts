import * as THREE from "three";
import { figColor } from "@/lib/figure-theme";
import type { Pt } from "./cuboid-figures";
import { baseRing, circumR, type PrismId } from "./prisms";
import type { Dims } from "./scene";

/**
 * The triangular and hexagonal prisms, drawn from the base ring in ./prisms.
 *
 * The cuboid keeps the six hinged faces already in ./scene — this layer exists
 * for the two figures that ring cannot describe, and ./scene hides one while it
 * shows the other. Both draw the same net (base flat, walls swung out about
 * their base edges, lid swung out past the first wall) because that is what
 * legacy/topic-cuboid.html's drawNet did for every prism it knew.
 *
 * The legacy page rebuilt every face on every frame. Here the geometry is
 * written once per size change and only the hinge angles move, so a drag costs
 * no allocation. The volume sweep is the same trick: the swept body is built at
 * full height and scaled on z, so `1 → t` of it is one number per frame.
 */

/** Six hues, spaced far enough apart that no two faces read the same. */
const FACE6 = [0xee4b3c, 0x8a3fd4, 0xf5901e, 0x2fa84f, 0x2472d6, 0xd93b85];
const SWEEP_BODY = 0x4c6ef0, SWEEP_CAP = 0x2472d6;

/** Hexagons are the widest base, so every buffer is cut for six sides. */
const MAXN = 6;

type Plate = THREE.Group & {
  userData: {
    mat: THREE.MeshLambertMaterial;
    lineMat: THREE.LineBasicMaterial;
    pos: THREE.Float32BufferAttribute;
    linePos: THREE.Float32BufferAttribute;
    geo: THREE.BufferGeometry;
  };
};

/**
 * A flat polygon of up to `maxN` sides: a fan of triangles from the centroid,
 * plus its outline. Sized for the widest figure and rewritten in place, so a
 * triangle is the same object as a hexagon with three sides collapsed.
 */
function plate(color: number, maxN: number, opacity = 1): Plate {
  const g = new THREE.Group() as Plate;
  const mat = new THREE.MeshLambertMaterial({
    color, side: THREE.DoubleSide, transparent: true, opacity,
  });
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.Float32BufferAttribute(new Float32Array(maxN * 9), 3);
  geo.setAttribute("position", pos);
  const mesh = new THREE.Mesh(geo, mat);
  // Rewritten in place, so the bounding sphere goes stale immediately.
  mesh.frustumCulled = false;
  g.add(mesh);

  const lineMat = new THREE.LineBasicMaterial({
    color: figColor("ink"), transparent: true, opacity: 0.55,
  });
  lineMat.userData.figRole = "ink";
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new THREE.Float32BufferAttribute(new Float32Array((maxN + 1) * 3), 3);
  lineGeo.setAttribute("position", linePos);
  const line = new THREE.Line(lineGeo, lineMat);
  line.frustumCulled = false;
  g.add(line);

  g.userData = { mat, lineMat, pos, linePos, geo };
  return g;
}

/** Writes `pts` into a plate. Spare triangles collapse onto the centroid. */
function setPlate(pl: Plate, pts: readonly Pt[]) {
  const n = pts.length;
  const { pos, linePos, geo } = pl.userData;
  const a = pos.array as Float32Array;

  let cx = 0, cy = 0, cz = 0;
  for (const q of pts) { cx += q[0]; cy += q[1]; cz += q[2]; }
  cx /= n; cy /= n; cz /= n;

  for (let i = 0; i < a.length / 9; i++) {
    const o = i * 9;
    const p = i < n ? pts[i] : null;
    const q = i < n ? pts[(i + 1) % n] : null;
    a[o] = cx; a[o + 1] = cy; a[o + 2] = cz;
    a[o + 3] = p ? p[0] : cx; a[o + 4] = p ? p[1] : cy; a[o + 5] = p ? p[2] : cz;
    a[o + 6] = q ? q[0] : cx; a[o + 7] = q ? q[1] : cy; a[o + 8] = q ? q[2] : cz;
  }
  pos.needsUpdate = true;

  const l = linePos.array as Float32Array;
  for (let i = 0; i < l.length / 3; i++) {
    // Walk the ring, then close on the first point and stay there.
    const p = pts[i < n ? i : 0];
    l[i * 3] = p[0]; l[i * 3 + 1] = p[1]; l[i * 3 + 2] = p[2];
  }
  linePos.needsUpdate = true;

  // Reuses the normal attribute after the first call, so this is not an
  // allocation — but it is only ever run on a size change, not per frame.
  geo.computeVertexNormals();
}

export type PrismLayer = {
  group: THREE.Group;
  /** Rebuilds at this size. Call when the figure or the dimensions change. */
  layout: (fig: PrismId, d: Dims) => void;
  /** 0 = folded shut, 1 = flat. Eased by the caller. */
  setUnfold: (e: number) => void;
  /** 0 = solid, 1 = glass, matching the box's own fade. */
  setGlass: (g: number) => void;
  /** How much of the base's sweep is filled in, 0 → 1. */
  setFill: (t: number) => void;
  /** Bounding radius at this fold, for framing. */
  radius: (e: number) => number;
  /** What the camera should look at, at this fold. */
  centre: (e: number, out: THREE.Vector3) => THREE.Vector3;
};

export function createPrismLayer(): PrismLayer {
  const group = new THREE.Group();
  group.name = "prism";
  group.visible = false;

  const bottom = plate(FACE6[1], MAXN);
  bottom.name = "bottom";
  group.add(bottom);

  /**
   * One wall per side. Each is two nested groups: `mount` carries the frame of
   * its own base edge, and `hinge` inside it carries the fold. They cannot be
   * one group — in three, writing `rotation` rewrites the quaternion, so a
   * fold would throw away the edge's orientation.
   */
  const walls: { mount: THREE.Group; hinge: THREE.Group; face: Plate }[] = [];
  for (let i = 0; i < MAXN; i++) {
    const mount = new THREE.Group();
    const hinge = new THREE.Group();
    const face = plate(FACE6[(i + 2) % 6], 4);
    face.name = `wall-${i}`;
    hinge.add(face);
    mount.add(hinge);
    group.add(mount);
    walls.push({ mount, hinge, face });
  }

  // The lid swings about the far edge of the first wall, on a hinge of its own
  // hung inside that wall's — so it carries the wall's fold and adds to it,
  // which is what puts it flat on the ground past the wall rather than upright.
  const lidHinge = new THREE.Group();
  const lid = plate(FACE6[0], MAXN);
  lid.name = "lid";
  lidHinge.add(lid);
  walls[0].hinge.add(lidHinge);

  /* ---- the volume sweep: built at full height, scaled on z ---- */
  const sweepG = new THREE.Group();
  // Named so the net and the sweep can be told apart from outside — they share
  // the same plate builder and sit under the same group.
  sweepG.name = "sweep";
  sweepG.visible = false;
  group.add(sweepG);
  const sweepCap = plate(SWEEP_CAP, MAXN, 0.95);
  sweepG.add(sweepCap);
  const sweepWalls: Plate[] = [];
  for (let i = 0; i < MAXN; i++) {
    const w = plate(SWEEP_BODY, 4, 0.34);
    sweepG.add(w);
    sweepWalls.push(w);
  }

  const PLATES = [bottom, lid, ...walls.map((w) => w.face)];

  let foldR = 1, flatR = 1;
  const foldC = new THREE.Vector3(), flatC = new THREE.Vector3();

  const _x = new THREE.Vector3(), _y = new THREE.Vector3();
  const _z = new THREE.Vector3(0, 0, 1);
  const _m = new THREE.Matrix4();

  function layout(fig: PrismId, d: Dims) {
    const ring = baseRing(fig, d);
    const n = ring.length;

    setPlate(bottom, ring);

    // Every point the flat net covers, collected as it is laid out.
    const net: Pt[] = ring.map((q) => [q[0], q[1], 0]);

    for (let i = 0; i < MAXN; i++) {
      const w = walls[i];
      w.mount.visible = i < n;
      if (i >= n) continue;

      const p = ring[i], q = ring[(i + 1) % n];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      // The ring runs anticlockwise, so the interior is to the left of an
      // edge: +y of the hinge frame points inward, and a positive turn about
      // its x lays the wall down outward.
      _x.set((q[0] - p[0]) / len, (q[1] - p[1]) / len, 0);
      _y.set(-_x.y, _x.x, 0);
      w.mount.position.set((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0);
      w.mount.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));

      setPlate(w.face, [
        [-len / 2, 0, 0], [len / 2, 0, 0], [len / 2, 0, d.H], [-len / 2, 0, d.H],
      ]);

      // Flat, this wall reaches one height straight out from its own edge.
      const ox = -_y.x * d.H, oy = -_y.y * d.H;
      net.push([p[0] + ox, p[1] + oy, 0], [q[0] + ox, q[1] + oy, 0]);
    }

    /* the lid, written in the first wall's hinge frame */
    const p0 = ring[0], q0 = ring[1];
    const len0 = Math.hypot(q0[0] - p0[0], q0[1] - p0[1]);
    _x.set((q0[0] - p0[0]) / len0, (q0[1] - p0[1]) / len0, 0);
    _y.set(-_x.y, _x.x, 0);
    const mx = (p0[0] + q0[0]) / 2, my = (p0[1] + q0[1]) / 2;
    lidHinge.position.set(0, 0, d.H);
    setPlate(
      lid,
      ring.map((v): Pt => {
        const wx = v[0] - mx, wy = v[1] - my;
        return [wx * _x.x + wy * _x.y, wx * _y.x + wy * _y.y, 0];
      }),
    );
    // Flat, the lid lies beyond the wall: a point that reached `y` inward when
    // the prism was shut ends up h + y out from the edge it hinges on.
    for (const v of ring) {
      const wx = v[0] - mx, wy = v[1] - my;
      const along = wx * _x.x + wy * _x.y;
      const across = d.H + (wx * _y.x + wy * _y.y);
      net.push([mx + _x.x * along - _y.x * across, my + _x.y * along - _y.y * across, 0]);
    }

    /* the sweep, at full height — setFill scales it back down */
    const top = ring.map((v): Pt => [v[0], v[1], d.H]);
    setPlate(sweepCap, top);
    for (let i = 0; i < MAXN; i++) {
      sweepWalls[i].visible = i < n;
      if (i >= n) continue;
      const j = (i + 1) % n;
      setPlate(sweepWalls[i], [ring[i], ring[j], top[j], top[i]]);
    }

    /* what the camera has to fit, at each end of the fold */
    foldC.set(0, 0, d.H / 2);
    foldR = Math.hypot(circumR(fig, d), d.H / 2);
    let cx = 0, cy = 0;
    for (const v of net) { cx += v[0]; cy += v[1]; }
    flatC.set(cx / net.length, cy / net.length, 0);
    flatR = 0;
    for (const v of net) flatR = Math.max(flatR, Math.hypot(v[0] - flatC.x, v[1] - flatC.y));
  }

  function setUnfold(e: number) {
    // π/2 lays a wall flat; the lid turns the same again to clear it, which is
    // the π(1−e) the legacy net swung the top through. Every hinge is written,
    // including the sides a triangle does not use, so none can go stale.
    for (const w of walls) w.hinge.rotation.x = (Math.PI / 2) * e;
    lidHinge.rotation.x = (Math.PI / 2) * e;
  }

  function setGlass(g: number) {
    for (const p of PLATES) {
      p.userData.mat.opacity = 1 - 0.86 * g;
      p.userData.lineMat.opacity = 0.55 + 0.45 * g;
    }
  }

  function setFill(t: number) {
    sweepG.visible = t > 0.002;
    // Scaling z is what moves the cap up: it is a flat lid at the full height,
    // so at t it sits at t·h with the walls stretched to meet it.
    sweepG.scale.z = Math.max(t, 1e-4);
  }

  return {
    group,
    layout,
    setUnfold,
    setGlass,
    setFill,
    radius: (e) => foldR + (flatR - foldR) * e,
    centre: (e, out) => out.copy(foldC).lerp(flatC, e),
  };
}
