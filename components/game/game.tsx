"use client";

import "katex/dist/katex.min.css";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import GamePlay from "./game-play";
import { LEVELS } from "@/lib/game/levels";
import { thumb } from "@/lib/game/thumb";
import { markStageProgress } from "@/app/[subject]/[topicSlug]/actions";
import { Button } from "@/components/ui/button";

export type GameProps = {
  topicId: string;
  alreadyStarted: boolean;
  initialUnlocked: number;
  initialBest: Readonly<Record<string, number>>;
  /** Back to the topic list — this is the last stage, so there is no next one. */
  subjectHref: string;
};

export default function Game({
  topicId, alreadyStarted, initialUnlocked, initialBest, subjectHref,
}: GameProps) {
  const [levelIdx, setLevelIdx] = useState<number | null>(null);
  // Bumped on every open so "Start over" and "Replay" remount the play view,
  // which is what resets the scene, the camera and every per-level bit of state.
  const [session, setSession] = useState(0);
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [best, setBest] = useState<Record<string, number>>({ ...initialBest });
  // Snapshotted when a level opens, so the end card can say whether this
  // solve is what opened the next one. State rather than a ref, because the
  // play view reads it during render.
  const [unlockedAtStart, setUnlockedAtStart] = useState(initialUnlocked);

  /* ---- progress ---- */
  useEffect(() => {
    if (alreadyStarted) return;
    void markStageProgress({ topicId, stageType: "game", status: "in_progress" });
  }, [topicId, alreadyStarted]);

  const writtenRef = useRef(JSON.stringify({ u: initialUnlocked, b: initialBest }));
  useEffect(() => {
    const key = JSON.stringify({ u: unlocked, b: best });
    if (key === writtenRef.current) return;
    writtenRef.current = key;
    void markStageProgress({
      topicId,
      stageType: "game",
      // Finished once every level has been beaten at least once.
      status: Object.keys(best).length >= LEVELS.length ? "completed" : "in_progress",
      details: { unlocked, best },
    });
  }, [unlocked, best, topicId]);

  const openLevel = useCallback((i: number) => {
    setUnlockedAtStart(unlocked);
    setLevelIdx(i);
    setSession((s) => s + 1);
  }, [unlocked]);

  const handleSolved = useCallback(
    (idx: number, moves: number) => {
      setBest((b) => ({
        ...b,
        [LEVELS[idx].id]: b[LEVELS[idx].id] === undefined
          ? moves
          : Math.min(b[LEVELS[idx].id], moves),
      }));
      setUnlocked((u) => Math.min(LEVELS.length, Math.max(u, idx + 2)));
    },
    [],
  );

  if (levelIdx !== null) {
    return (
      <GamePlay
        key={session}
        level={LEVELS[levelIdx]}
        levelIndex={levelIdx}
        unlockedAtStart={unlockedAtStart}
        onSolved={(m) => handleSolved(levelIdx, m)}
        onExit={() => setLevelIdx(null)}
        onOpenLevel={openLevel}
      />
    );
  }

  /* ============================================================
     menu — a page, not a figure, so it follows the app's theme
     ============================================================ */
  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-6 sm:py-16">
      <div className="mb-8 flex items-center gap-3">
        <i aria-hidden="true" className="size-1.5 rounded-full bg-brand ring-4 ring-brand/20" />
        <span className="font-mono text-eyebrow uppercase text-muted">Stereometry</span>
      </div>
      <h1 className="max-w-[16ch] text-display">
        Every length you need is already{" "}
        <em className="not-italic text-brand-text">there</em>.
      </h1>
      <p className="mt-6 max-w-[46ch] text-body-lg text-muted">
        This is not a test of arithmetic. Nothing here needs a calculator. What it asks is
        whether you can{" "}
        <b className="font-semibold text-fg">
          look at a solid and see which flat triangle is hiding inside it
        </b>{" "}
        — and which rule that triangle is waiting for.
      </p>

      <div className="mt-10 flex flex-wrap gap-6 border-t border-line pt-6">
        {[
          ["How it works", "Tap three points. The triangle they make comes out flat. Pick the rule that fits it."],
          ["What you win", "Nothing. No points, no streak. Just the length, and knowing how you got it."],
          ["The one limit", "Moves are counted. There is always a shortest route — finding it is the game."],
        ].map(([h, b]) => (
          <div key={h} className="flex-1 basis-[190px]">
            <b className="mb-1.5 block font-mono text-eyebrow uppercase text-brand-text">
              {h}
            </b>
            <p className="text-body-sm text-muted">{b}</p>
          </div>
        ))}
      </div>

      {Object.keys(best).length >= LEVELS.length && (
        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-correct bg-correct-soft px-4 py-4">
          <p className="text-body font-medium text-correct">
            All four solved — that is the whole topic finished.
          </p>
          <Button asChild className="self-start">
            <Link href={subjectHref}>Back to topics →</Link>
          </Button>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LEVELS.map((L, i) => {
          const locked = i >= unlocked;
          const done = best[L.id];
          const th = thumb(L);
          return (
            <button
              key={L.id}
              type="button"
              disabled={locked}
              aria-label={locked ? `${L.name} — locked` : L.name}
              onClick={() => !locked && openLevel(i)}
              className={`relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface p-0 text-left transition-[transform,border-color] duration-(--dur-state) ease-out ${
                locked
                  ? "cursor-not-allowed"
                  : "hover:-translate-y-1 hover:border-brand/60 motion-reduce:hover:translate-y-0"
              }`}
            >
              {/* The thumbnail sits on the figure's own ground, so it reads
                  as a small window onto the stage rather than a sticker. */}
              <span className="relative block aspect-[300/210] w-full flex-none bg-fig-ground">
                <svg
                  viewBox={`0 0 ${th.width} ${th.height}`}
                  className={`block h-full w-full ${locked ? "opacity-30 blur-[3px] saturate-50" : ""}`}
                  aria-hidden="true"
                >
                  {th.wire.map((w, n) => (
                    <line key={n} {...w} stroke="var(--fig-wire)" strokeWidth={1} opacity={0.75} strokeLinecap="round" />
                  ))}
                  <line {...th.target} stroke="var(--fig-target)" strokeWidth={2} strokeLinecap="round" />
                  {th.dots.map((d, n) => (
                    <circle key={n} cx={d.x} cy={d.y} r={2.4} fill="var(--fig-ink)" opacity={0.9} />
                  ))}
                </svg>
                {locked && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-fig-ground/75 text-fig-dim">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 opacity-70">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                    </svg>
                    <span className="font-mono text-eyebrow uppercase">locked</span>
                  </span>
                )}
                {done !== undefined && (
                  <span className="absolute right-3 top-3 rounded-full bg-fig-known px-2 py-0.5 font-mono text-eyebrow tabular-nums text-white">
                    {done} moves
                  </span>
                )}
              </span>
              <span className="flex flex-1 flex-col border-t border-line p-4">
                <span className="mb-1.5 font-mono text-eyebrow tabular-nums text-faint">
                  {String(i + 1).padStart(2, "0")} / 0{LEVELS.length}
                </span>
                <span className={`mb-1.5 text-h2 ${locked ? "text-muted" : ""}`}>
                  {L.name}
                </span>
                <span className="mb-3 min-h-[2.8em] text-body-sm leading-snug text-muted">
                  {L.tag}
                </span>
                <span className="mt-auto border-t border-line pt-2.5 font-mono text-eyebrow uppercase tracking-[0.05em] text-brand-text">
                  shortest route — {L.par} move{L.par > 1 ? "s" : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
