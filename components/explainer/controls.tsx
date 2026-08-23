"use client";

import type { ReactNode } from "react";
import { M } from "./math";
import {
  MAXD, apoLW, apoWH, faceDiag, halfDiag, nice, projPhi, pyrSurfaceArea,
  pyrVolume, soloAngle, soloLen, spaceDiag, surfaceArea, tppOblAngle, volume,
  type FaceKind, type PyrFaceKind, type Solid,
} from "@/lib/explainer/scene";
import type { ControlKind, SolidMode, UserState } from "@/lib/explainer/beats";

/* ---------- small pieces, matching the original panel's vocabulary ---------- */

function MBox({ hi, children }: { hi?: boolean; children: ReactNode }) {
  return (
    <div
      className={`mt-2 rounded-lg border px-3 py-2.5 text-body ${
        hi ? "border-brand/60 bg-brand-soft/40" : "border-line bg-raised"
      }`}
    >
      {children}
    </div>
  );
}

function MRow({ tag, children }: { tag?: string; children: ReactNode }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-body first:mt-0">
      {tag && (
        <span className="font-mono text-eyebrow uppercase text-muted">
          {tag}
        </span>
      )}
      {children}
    </div>
  );
}

function Scrub({
  left, right, value, min, max, step = 1, onChange, label,
}: {
  left?: string; right?: string; value: number; min: number; max: number;
  step?: number; onChange: (v: number) => void; label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {left && (
        <span className="whitespace-nowrap font-mono text-eyebrow uppercase text-muted">
          {left}
        </span>
      )}
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 min-w-0 flex-1 accent-(--lm-brand)"
      />
      {right && (
        <span className="whitespace-nowrap font-mono text-eyebrow uppercase text-muted">
          {right}
        </span>
      )}
    </div>
  );
}

function Chip({
  on, color, onClick, children,
}: {
  on: boolean; color: string; onClick: () => void; children: ReactNode;
}) {
  // The chip carries the face's own colour as a swatch rather than as a
  // fill behind white text: several of these hues (the ochres especially)
  // never clear 4.5:1 against white, and the swatch is the honest mapping
  // anyway — it is a legend for what is highlighted in the figure.
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`press flex items-center gap-2 rounded-md border px-3 py-2 text-body-sm ${
        on ? "border-current bg-raised font-semibold text-fg" : "border-line text-muted hover:text-fg"
      }`}
      style={on ? { borderColor: color, boxShadow: `0 0 0 3px ${color}26` } : undefined}
    >
      <span
        aria-hidden="true"
        className="size-2 flex-none rounded-full"
        style={{ background: color }}
      />
      {children}
    </button>
  );
}

function SolidToggle({
  solid, setSolid,
}: {
  solid: Solid;
  setSolid: (s: Solid) => void;
}) {
  return (
    <div className="mb-2.5 flex gap-1.5" role="group" aria-label="Choose a solid">
      {(["box", "pyr"] as const).map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={solid === k}
          onClick={() => solid !== k && setSolid(k)}
          className={`press flex-1 rounded-lg border px-3 py-2 text-body-sm ${
            solid === k
              ? "border-brand bg-brand font-semibold text-brand-on"
              : "border-line text-muted hover:text-fg"
          }`}
        >
          {k === "box" ? "Box" : "Pyramid"}
        </button>
      ))}
    </div>
  );
}

/* ---------- face kinds, from FACE_KINDS in the original ---------- */

const FACE_KINDS: Record<
  FaceKind,
  { label: string; css: string; note: ReactNode; tex: (d: UserState["dims"]) => string }
> = {
  base: {
    label: "base", css: "#E8B84B",
    note: "The face it stands on. Every height is measured from here.",
    tex: (D) => `S=${D.L}\\cdot${D.W}=${D.L * D.W}`,
  },
  lateral: {
    label: "lateral face", css: "#5FB0A6",
    note: "A side wall. “Lateral area” means the four walls only — no top, no bottom.",
    tex: (D) => `S=${D.L}\\cdot${D.H}=${D.L * D.H}`,
  },
  diagonal: {
    label: "diagonal section", css: "#E27A5F",
    note: "A cut through two opposite vertical edges. Its width is the base diagonal — find that first.",
    tex: (D) =>
      `S=\\sqrt{${D.L}^2+${D.W}^2}\\cdot${D.H}=${nice(faceDiag(D))}\\cdot${D.H}=${nice(faceDiag(D) * D.H)}`,
  },
  tilted: {
    label: "tilted section", css: "#B88BE0",
    note: "A cut that is parallel to nothing. Still a rectangle — one side is an edge, the other is a face diagonal.",
    tex: (D) =>
      `S=${D.L}\\cdot\\sqrt{${D.W}^2+${D.H}^2}=${D.L}\\cdot${nice(Math.hypot(D.W, D.H))}=${nice(D.L * Math.hypot(D.W, D.H))}`,
  },
};

/* ---------- pyramid sections, from PYR_FACES in topic.html ---------- */

const PYR_FACES: Record<
  PyrFaceKind,
  { label: string; css: string; note: ReactNode; tex: (d: UserState["dims"]) => string }
> = {
  base: {
    label: "base", css: "#6D5BD0",
    note: "The square it stands on. The apex sits directly above its centre.",
    tex: (D) => `S=${D.L}\\cdot${D.W}=${D.L * D.W}`,
  },
  lateral: {
    label: "lateral face", css: "#17C2B4",
    note: (
      <>
        One of the four triangles. Its height is the <b>apothem</b> — not the lateral
        edge.
      </>
    ),
    tex: (D) =>
      `S=\\tfrac12\\cdot${D.L}\\cdot${nice(apoLW(D))}=${nice((D.L * apoLW(D)) / 2)}`,
  },
  apo: {
    label: "through the apothem", css: "#E39A22",
    note: "A cut straight down the middle, hitting two opposite base edges. Contains the height.",
    tex: (D) => `S=\\tfrac12\\cdot${D.W}\\cdot${D.H}=${nice((D.W * D.H) / 2)}`,
  },
  diag: {
    label: "through the diagonal", css: "#E8442A",
    note: "A cut through two opposite base corners and the apex. Its base is the base diagonal.",
    tex: (D) =>
      `S=\\tfrac12\\cdot${nice(2 * halfDiag(D))}\\cdot${D.H}=${nice(halfDiag(D) * D.H)}`,
  },
};

/* ---------- the panel ---------- */

export type ControlProps = {
  kind: ControlKind;
  solids: SolidMode;
  user: UserState;
  set: (patch: Partial<UserState>) => void;
  /** Separate from `set` because switching solids also re-applies the beat's entry state. */
  setSolid: (s: Solid) => void;
};

export default function Controls({ kind, solids, user, set, setSolid }: ControlProps) {
  const D = user.dims;
  const pyr = user.solid === "pyr";
  // Only the beats that work for either solid offer the switch. Held as an
  // element rather than a component so it is not redeclared each render.
  const toggle =
    solids === "both" ? <SolidToggle solid={user.solid} setSolid={setSolid} /> : null;

  switch (kind) {
    case "none":
      return null;

    case "dims":
      return (
        <div>
          {toggle}
          <div className="flex flex-col gap-0.5">
            {(["L", "W", "H"] as const).map((k) => (
              <div key={k} className="flex items-center gap-3">
                <span className="w-4 font-mono text-num text-muted">{k.toLowerCase()}</span>
                <input
                  type="range"
                  aria-label={`${k.toLowerCase()} — ${D[k]}`}
                  min={1}
                  max={MAXD}
                  step={1}
                  value={D[k]}
                  onChange={(e) =>
                    set({ dims: { ...D, [k]: Number(e.target.value) } })
                  }
                  className="h-8 min-w-0 flex-1 accent-(--lm-brand)"
                />
                <span className="w-5 font-mono text-num tabular-nums text-fg">{D[k]}</span>
              </div>
            ))}
          </div>
          <MBox>
            <MRow>
              {pyr ? (
                <>
                  <M tex={`S=${D.L}\\cdot${D.W}+${D.L}\\cdot${nice(apoLW(D))}+${D.W}\\cdot${nice(apoWH(D))}=${nice(pyrSurfaceArea(D))}`} />
                  <M tex={`V=\\tfrac13\\cdot${D.L * D.W}\\cdot${D.H}=${nice(pyrVolume(D))}`} />
                </>
              ) : (
                <>
                  <M tex={`S=${surfaceArea(D)}`} />
                  <M tex={`V=${volume(D)}`} />
                </>
              )}
            </MRow>
          </MBox>
        </div>
      );

    case "unfoldSum": {
      const flat = user.unfold > 0.45;
      const base = D.L * D.W;
      const sides = D.L * apoLW(D) + D.W * apoWH(D);
      return (
        <div>
          {toggle}
          <Scrub
            label={pyr ? "Unfold the pyramid" : "Unfold the box"}
            left="folded" right="flat"
            min={0} max={100} value={Math.round(user.unfold * 100)}
            onChange={(v) => set({ unfold: v / 100 })}
          />
          <MBox>
            {pyr ? (
              flat ? (
                <>
                  <M tex={`\\underbrace{${D.L}\\cdot${D.W}}_{\\text{base}}+\\underbrace{2\\cdot\\tfrac12 ${D.L}\\cdot${nice(apoLW(D))}+2\\cdot\\tfrac12 ${D.W}\\cdot${nice(apoWH(D))}}_{\\text{four triangles}}=\\textbf{${nice(base + sides)}}`} />
                  <MRow tag="the slant heights">
                    <M tex="\sqrt{(w/2)^2+h^2},\ \sqrt{(l/2)^2+h^2}" />
                  </MRow>
                </>
              ) : (
                <span className="text-muted">
                  drag it flat — a pyramid opens into a base and four triangles
                </span>
              )
            ) : flat ? (
              <>
                <M tex={`2(${D.L}\\cdot${D.W})+2(${D.L}\\cdot${D.H})+2(${D.W}\\cdot${D.H})=\\textbf{${surfaceArea(D)}}`} />
                <MRow tag="in general">
                  <M tex="S=2(lw+lh+wh)" />
                </MRow>
              </>
            ) : (
              <span className="text-muted">
                drag it flat to see all six faces at once
              </span>
            )}
          </MBox>
        </div>
      );
    }

    case "fill": {
      const V = volume(D), per = D.L * D.W, n = Math.round(user.fill);
      const layers = Math.floor(n / per), rem = n % per;
      // The pyramid argues from the containing box instead of counting cubes,
      // so it replaces the slider outright rather than disabling it.
      if (pyr) {
        return (
          <div>
            {toggle}
            <MBox>
              <M tex={`V_{\\text{box}}=${D.L}\\cdot${D.W}\\cdot${D.H}=${V}`} />
            </MBox>
            <MBox hi>
              <M tex={`V_{\\text{pyramid}}=\\tfrac13\\cdot${V}=${nice(pyrVolume(D))}`} />
            </MBox>
            <MRow tag="why a third">
              <span className="text-muted">
                three of this pyramid fill the box exactly
              </span>
            </MRow>
          </div>
        );
      }
      return (
        <div>
          {toggle}
          <Scrub
            label="Fill the box with unit cubes" left="empty" right="full"
            min={0} max={V} value={n} onChange={(v) => set({ fill: v })}
          />
          <MBox>
            {n === V ? (
              <M tex={`\\underbrace{${per}}_{\\text{one layer}} \\times \\underbrace{${D.H}}_{\\text{layers}} = \\textbf{${V}}`} />
            ) : layers > 0 ? (
              <M tex={`${layers}\\times${per} + ${rem} = ${n}`} />
            ) : (
              <M tex={`${n}\\ \\text{cubes} \\quad (${per}\\ \\text{fill one layer})`} />
            )}
          </MBox>
        </div>
      );
    }

    case "double": {
      const sa = pyr ? pyrSurfaceArea(D) : surfaceArea(D);
      const v = pyr ? pyrVolume(D) : volume(D);
      return (
        <div>
          {toggle}
          <button
            type="button"
            aria-pressed={user.doubled}
            onClick={() => set({ doubled: !user.doubled })}
            className={`press w-full rounded-lg border px-4 py-2.5 text-body ${
              user.doubled
                ? "border-brand bg-brand font-semibold text-brand-on"
                : "border-line bg-raised hover:border-line-strong"
            }`}
          >
            {user.doubled ? "back to original" : "double every edge"}
          </button>
          <MBox><M tex={`S:\\ ${nice(sa)}\\ \\to\\ ${nice(sa * 4)}\\quad(\\times 2^2)`} /></MBox>
          <MBox><M tex={`V:\\ ${nice(v)}\\ \\to\\ ${nice(v * 8)}\\quad(\\times 2^3)`} /></MBox>
          {pyr && (
            <p className="mt-2 text-body-sm text-muted">
              the outline is the same pyramid with every edge doubled
            </p>
          )}
        </div>
      );
    }

    case "diag":
      return (
        <div>
          <MBox>
            <MRow tag="across a face">
              <M tex={`d_1=\\sqrt{${D.L}^2+${D.W}^2}=\\textcolor{#5FB0A6}{${nice(faceDiag(D))}}`} />
            </MRow>
          </MBox>
          <MBox hi>
            <MRow tag="through the box">
              <M tex={`d=\\sqrt{${nice(faceDiag(D))}^2+${D.H}^2}=\\textcolor{#E8B84B}{${nice(spaceDiag(D))}}`} />
            </MRow>
          </MBox>
          <MRow tag="in general">
            <M tex="d=\sqrt{l^2+w^2+h^2}" />
          </MRow>
        </div>
      );

    case "faces": {
      const set_ = pyr ? PYR_FACES : FACE_KINDS;
      const cur = pyr ? user.pyrFaceKind : user.faceKind;
      const f = pyr ? PYR_FACES[user.pyrFaceKind] : FACE_KINDS[user.faceKind];
      return (
        <div>
          {toggle}
          <div className="flex flex-wrap gap-2">
            {Object.keys(set_).map((k) => (
              <Chip
                key={k}
                on={k === cur}
                color={set_[k as keyof typeof set_].css}
                onClick={() =>
                  pyr
                    ? set({ pyrFaceKind: k as PyrFaceKind })
                    : set({ faceKind: k as FaceKind })
                }
              >
                {set_[k as keyof typeof set_].label}
              </Chip>
            ))}
          </div>
          <MBox hi><M tex={f.tex(D)} /></MBox>
          <p className="mt-2 text-body-sm text-muted">{f.note}</p>
        </div>
      );
    }

    case "par":
      return (
        <div>
          <Scrub
            label="Slide the segment" left="home" right="slid"
            min={0} max={100} value={Math.round(user.parT * 100)}
            onChange={(v) => set({ parT: v / 100 })}
          />
          <MBox>
            <M tex={`\\text{length before}=${D.H}\\qquad\\text{length after}=${D.H}`} />
          </MBox>
        </div>
      );

    case "cri":
      return (
        <div>
          <Scrub
            label="Turn the third line" left="turn the third line"
            min={0} max={179} value={Math.round(user.criAng)}
            onChange={(v) => set({ criAng: v })}
          />
          <MBox hi>
            <M tex="\angle(\text{standing line},\ \text{any line in the plane})=90^\circ" />
            <p className="mt-2 text-brand-text">still 90° — and it always will be</p>
          </MBox>
        </div>
      );

    case "angDist": {
      // Merges the old angle slide with the distance material: one triangle,
      // both readouts.
      const proj = soloLen();
      const slant = Math.hypot(user.soloH, proj);
      return (
        <div>
          <Scrub
            label="Raise point A" left="raise A"
            min={10} max={90} value={Math.round(user.soloH * 10)}
            onChange={(v) => set({ soloH: v / 10 })}
          />
          <MBox hi>
            <M tex={`\\tan\\alpha=\\frac{${user.soloH.toFixed(1)}}{${proj.toFixed(2)}}\\;\\Rightarrow\\;\\alpha=${soloAngle(user.soloH).toFixed(1)}^\\circ`} />
            <br />
            <M tex={`\\text{to the plane}=${user.soloH.toFixed(1)}\\qquad\\text{to the line}=${slant.toFixed(2)}`} />
          </MBox>
        </div>
      );
    }

    case "solo":
      return (
        <div>
          <Scrub
            label="Raise point A" left="raise A"
            min={10} max={90} value={Math.round(user.soloH * 10)}
            onChange={(v) => set({ soloH: v / 10 })}
          />
          <MBox>
            <M tex={`\\tan\\alpha=\\frac{AH}{HM}=\\frac{${user.soloH.toFixed(1)}}{${soloLen().toFixed(2)}}`} />
            <br />
            <M tex={`\\alpha=\\textcolor{#E8B84B}{${soloAngle(user.soloH).toFixed(1)}^\\circ}`} />
          </MBox>
        </div>
      );

    case "tpp": {
      const o = tppOblAngle(D, user.tppTheta);
      const locked = Math.round(user.tppTheta) === 90;
      return (
        <div>
          <Scrub
            label="Turn line a" left="turn a"
            min={10} max={170} value={Math.round(user.tppTheta)}
            onChange={(v) => set({ tppTheta: v })}
          />
          <MBox hi={locked}>
            <M tex={`a \\perp HM \\;?\\quad \\textcolor{#5FB0A6}{${user.tppTheta.toFixed(0)}^\\circ}`} />
            <br />
            <M tex={`a \\perp AM \\;?\\quad \\textcolor{#E8B84B}{${o.toFixed(1)}^\\circ}`} />
            <p className={`mt-2 ${locked ? "text-brand-text" : "text-muted"}`}>
              {locked
                ? "both exactly 90° — the theorem holds"
                : "not 90° to the projection, so not 90° to the oblique either"}
            </p>
          </MBox>
        </div>
      );
    }

    case "prj": {
      const St = D.L * Math.hypot(D.W, D.H), Sp = D.L * D.W;
      return (
        <div>
          <MBox>
            <MRow tag="the angle itself">
              <M tex={`\\tan\\varphi=\\frac{${D.H}}{${D.W}}\\;\\Rightarrow\\;\\varphi=${projPhi(D).toFixed(1)}^\\circ`} />
            </MRow>
          </MBox>
          <MBox>
            <MRow tag="tilted">
              <M tex={`S=${D.L}\\cdot\\sqrt{${D.W}^2+${D.H}^2}=${nice(St)}`} />
            </MRow>
          </MBox>
          <MBox>
            <MRow tag="its shadow">
              <M tex={`S'=${D.L}\\cdot${D.W}=${Sp}`} />
            </MRow>
          </MBox>
          <MBox hi>
            <M tex={`\\cos\\varphi=\\frac{S'}{S}=\\frac{${Sp}}{${nice(St)}}=${nice(Sp / St)}\\;\\Rightarrow\\; \\varphi=${projPhi(D).toFixed(1)}^\\circ`} />
          </MBox>
        </div>
      );
    }
  }
}

