"use client";

import { dist, fmtPlain, getLen, nm, type GameState } from "@/lib/game/engine";

/**
 * The triangle a move worked in, unfolded flat — ported from triSVG in
 * legacy/game.html. Known sides read blue with their length; the unknown one
 * reads red with a "?".
 */
export default function TriSvg({
  state, keys,
}: {
  state: GameState;
  keys: readonly [string, string, string];
}) {
  const [k1, k2, k3] = keys;
  const L12 = dist(state.PT, k1, k2);
  const L23 = dist(state.PT, k2, k3);
  const L31 = dist(state.PT, k3, k1);

  const x3 = (L12 * L12 + L31 * L31 - L23 * L23) / (2 * L12);
  const y3 = Math.sqrt(Math.max(0, L31 * L31 - x3 * x3));
  const raw: [number, number][] = [[0, 0], [L12, 0], [x3, y3]];

  const W = 330, H = 180, PAD = 42;
  const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1]);
  const mnx = Math.min(...xs), mxx = Math.max(...xs);
  const mny = Math.min(...ys), mxy = Math.max(...ys);
  const sc = Math.min((W - 2 * PAD) / (mxx - mnx || 1), (H - 2 * PAD) / (mxy - mny || 1));
  const ox = (W - (mxx - mnx) * sc) / 2 - mnx * sc;
  const oy = (H - (mxy - mny) * sc) / 2 - mny * sc;
  const q = raw.map((p) => [ox + p[0] * sc, H - (oy + p[1] * sc)] as [number, number]);
  const cen = [
    (q[0][0] + q[1][0] + q[2][0]) / 3,
    (q[0][1] + q[1][1] + q[2][1]) / 3,
  ];

  const edges: [number, number, string, string][] = [
    [0, 1, k1, k2], [1, 2, k2, k3], [2, 0, k3, k1],
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Triangle ${keys.map(nm).join("")}`}
      className="block h-auto w-full rounded-lg bg-white"
      style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
    >
      <polygon
        points={q.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")}
        fill="#2B4FE8" fillOpacity={0.12}
      />
      {edges.map(([i, j, p, r], n) => {
        const v = getLen(state, p, r);
        const known = v !== undefined;
        const mx = (q[i][0] + q[j][0]) / 2, my = (q[i][1] + q[j][1]) / 2;
        const dx = mx - cen[0], dy = my - cen[1], dl = Math.hypot(dx, dy) || 1;
        return (
          <g key={n}>
            <line
              x1={q[i][0]} y1={q[i][1]} x2={q[j][0]} y2={q[j][1]}
              stroke={known ? "#2340C4" : "#93A09A"}
              strokeWidth={known ? 2.2 : 1.6}
              strokeLinecap="round"
            />
            <text
              x={mx + (dx / dl) * 16} y={my + (dy / dl) * 16 + 4}
              fontSize={11.5} fontWeight={700}
              fill={known ? "#2340C4" : "#E8442A"} textAnchor="middle"
            >
              {known ? fmtPlain(v) : "?"}
            </text>
          </g>
        );
      })}
      {q.map((p, i) => {
        const dx = p[0] - cen[0], dy = p[1] - cen[1], dl = Math.hypot(dx, dy) || 1;
        return (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={2.8} fill="#14181A" />
            <text
              x={p[0] + (dx / dl) * 17} y={p[1] + (dy / dl) * 17 + 4.5}
              fontSize={12.5} fontWeight={700} fill="#14181A" textAnchor="middle"
            >
              {nm(keys[i])}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
