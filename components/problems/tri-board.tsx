"use client";

import { triShape, type Points } from "@/lib/problems/geometry";

/**
 * One triangle of the figure, unfolded to its true shape.
 *
 * The original emitted an SVG string; this builds the same drawing from the
 * shape data so it stays typed and needs no innerHTML.
 */
export default function TriBoard({
  points, keys, ink = "#2340C4", givenOnly, known, onClick, label,
}: {
  points: Points;
  keys: [string, string, string];
  ink?: string;
  givenOnly?: boolean;
  known?: readonly (readonly [string, string])[];
  onClick?: () => void;
  label: string;
}) {
  const s = triShape(points, keys, { givenOnly, known });

  return (
    <svg
      viewBox={`0 0 ${s.width} ${s.height}`}
      role="img"
      aria-label={label}
      onClick={onClick}
      className={`block h-auto max-h-[190px] w-full ${onClick ? "cursor-pointer" : ""}`}
      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
    >
      <polygon points={s.poly} fill={ink} fillOpacity={0.07} />
      {s.edges.map((e, i) => (
        <g key={i}>
          <line
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke={ink} strokeWidth={2} strokeLinecap="round"
          />
          {e.label && (
            <text
              x={e.lx} y={e.ly} fontSize={11.5} fontWeight={600}
              fill={ink} textAnchor="middle"
            >
              {e.label}
            </text>
          )}
        </g>
      ))}
      {s.rightAngles.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={ink} strokeWidth={1.4} opacity={0.65} />
      ))}
      {s.verts.map((v, i) => (
        <g key={i}>
          <circle cx={v.x} cy={v.y} r={3} fill="#14181A" />
          <text
            x={v.lx} y={v.ly} fontSize={12.5} fontWeight={600}
            fill="#14181A" textAnchor="middle"
          >
            {v.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
