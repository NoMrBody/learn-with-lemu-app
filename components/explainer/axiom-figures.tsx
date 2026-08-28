/**
 * The two drawn asides in the axioms panel, ported from legSVG() and
 * rulerSVG() in legacy/axioms.html.
 *
 * Both make the same argument: the axiom is not arbitrary, because you can
 * feel what goes wrong with fewer. A stool spins on one leg and rocks on two;
 * a ruler pivots when it touches a surface at one point and lifts off a curved
 * one. The third drawing in each row is the case the axiom describes.
 *
 * The original concatenated SVG strings with literal hex. Here the colour is
 * `currentColor` on a themed wrapper, so both drawings follow the theme with
 * no second palette to keep in step.
 */

type Trio = { key: string; caption: string; ok: boolean };

function Row({ label, items }: { label: string; items: readonly (Trio & { art: React.ReactNode })[] }) {
  return (
    <ul
      aria-label={label}
      className="flex list-none items-end gap-2 sm:gap-4"
    >
      {items.map((it) => (
        <li key={it.key} className="flex-1 text-center">
          {it.art}
          <span
            className={`mt-1.5 block font-mono text-eyebrow uppercase ${
              it.ok ? "font-semibold text-fg" : "text-faint"
            }`}
          >
            {it.caption}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ============================================================
   one leg spins, two rock, three are steady
   ============================================================ */

/** Where each leg meets the floor, and where it leaves the seat. */
const LEG_GEOMETRY: Record<1 | 2 | 3, { feet: [number, number][]; tops: [number, number][] }> = {
  1: { feet: [[46, 84]], tops: [[46, 40]] },
  2: { feet: [[28, 86], [64, 86]], tops: [[36, 42], [56, 42]] },
  3: { feet: [[24, 88], [46, 90], [68, 88]], tops: [[32, 43], [46, 44], [60, 43]] },
};

/** The little motion marks either side of a stool that will not stay put. */
const WOBBLE: Record<1 | 2 | 3, [string, string]> = {
  1: ["M70 24 q8 -6 4 -14", "M12 24 q-8 -6 -4 -14"],
  2: ["M74 30 q9 -4 7 -13", "M8 30 q-9 -4 -7 -13"],
  3: ["M74 30 q9 -4 7 -13", "M8 30 q-9 -4 -7 -13"],
};

function Stool({ legs, ok }: { legs: 1 | 2 | 3; ok: boolean }) {
  const { feet, tops } = LEG_GEOMETRY[legs];
  // An unsteady stool is drawn already tipping; the steady one sits square.
  const tilt = ok ? 0 : legs === 1 ? -7 : -4;
  const seat = ok ? "fill-known-soft" : "fill-fig-inset";

  return (
    <svg
      viewBox="0 0 92 100"
      aria-hidden="true"
      className={`block h-[clamp(74px,13vh,104px)] w-full ${
        ok ? "text-fig-known" : "text-fig-wire"
      }`}
    >
      <g transform={`rotate(${tilt} 46 60)`} stroke="currentColor" fill="none">
        <ellipse cx="46" cy="34" rx="27" ry="9" strokeWidth="2.6" className={seat} />
        <path
          d="M19 34 v5 a27 9 0 0 0 54 0 v-5"
          strokeWidth="2.6"
          strokeLinejoin="round"
          className={seat}
        />
        {feet.map((f, i) => (
          <path
            key={i}
            d={`M${tops[i][0]} ${tops[i][1]} L${f[0]} ${f[1]}`}
            strokeWidth="3.4"
            strokeLinecap="round"
          />
        ))}
        {legs === 3 && (
          <path
            d="M30 70 L46 74 L62 70"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
        )}
      </g>
      {!ok &&
        WOBBLE[legs].map((d, i) => (
          <path
            key={i}
            d={d}
            className="stroke-fig-target"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.55"
          />
        ))}
    </svg>
  );
}

export function LegsFigure() {
  return (
    <Row
      label="One leg spins, two rock, three are steady"
      items={[
        { key: "1", caption: "one — spins", ok: false, art: <Stool legs={1} ok={false} /> },
        { key: "2", caption: "two — rocks", ok: false, art: <Stool legs={2} ok={false} /> },
        { key: "3", caption: "three — steady", ok: true, art: <Stool legs={3} ok /> },
      ]}
    />
  );
}

/* ============================================================
   a ruler on a table
   ============================================================ */

type RulerKind = "one" | "curved" | "flat";

function Ruler({ kind }: { kind: RulerKind }) {
  const ok = kind === "flat";
  const body = ok ? "fill-correct-soft" : "fill-fig-inset";

  return (
    <svg
      viewBox="0 0 112 92"
      aria-hidden="true"
      className={`block h-[clamp(74px,13vh,104px)] w-full ${
        ok ? "text-correct" : "text-fig-wire"
      }`}
    >
      <g stroke="currentColor" fill="none">
        {kind === "curved" ? (
          <path d="M6 78 Q56 56 106 78" strokeWidth="2.6" strokeLinecap="round" />
        ) : (
          <path d="M6 74 L106 74" strokeWidth="2.6" strokeLinecap="round" />
        )}

        {/* Touching at a single point, the ruler is free to pivot about it. */}
        {kind === "one" ? (
          <g transform="rotate(-15 56 60)">
            <rect x="16" y="52" width="80" height="11" rx="2.5" strokeWidth="2.4" className={body} />
          </g>
        ) : (
          <rect
            x="16"
            y={kind === "curved" ? 60 : 62}
            width="80"
            height="11"
            rx="2.5"
            strokeWidth="2.4"
            className={body}
          />
        )}

        {kind === "one" && <circle cx="24" cy="74" r="3.6" className="fill-current" stroke="none" />}
        {kind === "curved" && (
          <>
            <circle cx="19" cy="72.5" r="3.6" className="fill-current" stroke="none" />
            <circle cx="93" cy="72.5" r="3.6" className="fill-current" stroke="none" />
            {/* The gap in the middle: the ends touch, the body does not. */}
            <path
              d="M46 71 L46 64 M66 71 L66 64"
              className="stroke-fig-target"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            />
          </>
        )}
        {kind === "flat" && (
          <>
            <circle cx="22" cy="73" r="3.6" className="fill-current" stroke="none" />
            <circle cx="90" cy="73" r="3.6" className="fill-current" stroke="none" />
          </>
        )}
      </g>
    </svg>
  );
}

export function RulerFigure() {
  return (
    <Row
      label="One point pivots, a curved surface lifts, a flat one lies"
      items={[
        { key: "one", caption: "one point — it pivots", ok: false, art: <Ruler kind="one" /> },
        { key: "curved", caption: "curved — it lifts", ok: false, art: <Ruler kind="curved" /> },
        { key: "flat", caption: "flat — it lies", ok: true, art: <Ruler kind="flat" /> },
      ]}
    />
  );
}
