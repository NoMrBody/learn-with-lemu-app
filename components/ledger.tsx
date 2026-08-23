"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The Ledger — LeMiu's signature element.
 *
 * A running column of every quantity you have established, in tabular mono,
 * growing as you work. It is the product's thesis made visible: the game's
 * premise is that every length you need is already there, so the reward for
 * a good move is a new line here rather than a point score.
 *
 * A row that is new this render lands with a rise-and-settle and holds the
 * "found" colour for one beat before cooling to "known", so the eye is drawn
 * to what just changed without the whole column flashing.
 */

export type LedgerState = "given" | "found" | "target";

export type LedgerRow = {
  /** Stable across renders — this is what "new since last time" is keyed on. */
  id: string;
  /** The quantity, e.g. "AC₁". Rendered as-is. */
  label: string;
  /** The value, e.g. "13.42" or "√41". The target row passes "?". */
  value: string;
  state: LedgerState;
};

const STATE_STYLE: Record<LedgerState, { row: string; label: string; value: string }> = {
  given: {
    row: "border-line bg-surface",
    label: "text-muted",
    value: "text-fg",
  },
  found: {
    row: "border-line bg-surface",
    label: "text-muted",
    value: "text-known",
  },
  target: {
    row: "border-dashed border-brand/55 bg-brand-soft/40",
    label: "text-brand-text",
    value: "text-brand-text",
  },
};

const STATE_NOTE: Record<LedgerState, string> = {
  given: "given",
  found: "found",
  target: "still to find",
};

export function Ledger({
  rows,
  title = "What you know",
  className,
  empty = "Nothing yet — every length you establish gets written down here.",
}: {
  rows: readonly LedgerRow[];
  title?: string;
  className?: string;
  empty?: string;
}) {
  // Which ids are landing right now, compared against the previous render so
  // a row that reappears after an undo animates again.
  //
  // Keyed on the joined ids rather than `rows`: callers rebuild that array
  // every render, so depending on it directly would re-run this on every
  // render. Combined with the timer living in a ref, that is what keeps a
  // no-op re-render from cancelling an in-flight highlight and leaving every
  // row stuck in the "just found" state.
  const seen = useRef<Set<string> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const key = rows.map((r) => r.id).join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    // First paint is the starting position, not a discovery — seed the set
    // and highlight nothing, or the whole column flashes on mount.
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const added = ids.filter((id) => !seen.current!.has(id));
    seen.current = new Set(ids);
    if (added.length === 0) return;

    setFresh(new Set(added));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFresh(new Set()), 900);
  }, [key]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <h3 className="flex items-center gap-2 font-mono text-eyebrow uppercase text-muted">
        {title}
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
        <span className="tabular-nums text-faint">
          {rows.filter((r) => r.state !== "target").length}
        </span>
      </h3>

      {rows.length === 0 ? (
        <p className="text-body-sm text-faint">{empty}</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {rows.map((r) => {
            const s = STATE_STYLE[r.state];
            const isFresh = fresh.has(r.id);
            return (
              <li
                key={r.id}
                className={cn(
                  "flex items-baseline gap-3 rounded-md border px-2.5 py-1.5",
                  "font-mono text-body-sm tabular-nums",
                  "transition-[color,background-color,border-color] duration-(--dur-celebrate) ease-out",
                  s.row,
                  isFresh && "border-correct bg-correct-soft",
                  isFresh && "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1",
                )}
              >
                <span className={cn(s.label, isFresh && "text-fg")}>{r.label}</span>
                <span aria-hidden="true" className="text-faint">
                  =
                </span>
                <span
                  className={cn(
                    "ml-auto font-semibold",
                    s.value,
                    isFresh && "text-correct",
                  )}
                >
                  {r.value}
                </span>
                <span className="sr-only">({STATE_NOTE[r.state]})</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
