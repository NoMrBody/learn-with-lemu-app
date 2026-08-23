"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { M } from "@/components/explainer/math";
import { Rich } from "@/lib/problems/rich";
import TriSvg from "./tri-svg";
import { Ledger, type LedgerRow } from "@/components/ledger";
import { Button } from "@/components/ui/button";
import { LEVELS, type Level } from "@/lib/game/levels";
import {
  TOOLS, disp, fmt, fmtPlain, gainedKeys, getLen, initialState, isSolved, movesLeft,
  nudgeFor, nm, type GameState, type MoveResult, type Tool,
} from "@/lib/game/engine";
import { createGameScene, type GameScene } from "@/lib/game/scene";

/**
 * One level being played.
 *
 * Split out from the menu so the stage refs exist the moment this mounts —
 * the scene is created in a mount effect, and while the menu was rendering
 * instead there was nothing for it to attach to.
 *
 * Everything here floats on the figure's own ground rather than the page's,
 * so it is styled from the --fig-* tokens: the HUD, the dock and the working
 * drawer are sheets of the stage's paper, not of the app's surface. Those
 * tokens have light and dark pairs, which is what this view used to lack —
 * it previously hardcoded a light palette through inline styles and stayed
 * bright no matter the theme.
 */

type Toast = { text: string; warn?: boolean } | null;
type LogEntry = { move: number; result: MoveResult; state: GameState };

export default function GamePlay({
  level, levelIndex, unlockedAtStart, onSolved, onExit, onOpenLevel,
}: {
  level: Level;
  levelIndex: number;
  unlockedAtStart: number;
  onSolved: (moves: number) => void;
  onExit: () => void;
  onOpenLevel: (i: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GameScene | null>(null);

  const [state, setState] = useState<GameState>(() => initialState(level));
  const [picks, setPicks] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [undoStack, setUndoStack] = useState<{ state: GameState; moves: number }[]>([]);
  const [toast, setToast] = useState<Toast>({ text: `<b>${level.name}.</b> ${level.brief}` });
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [workOpen, setWorkOpen] = useState(false);
  const [ended, setEnded] = useState(false);

  const solvedNow = isSolved(state, level);
  const outOfMoves = moves >= level.budget && !solvedNow;
  const frozen = solvedNow || outOfMoves;

  /* ---- the scene: created on mount, when the refs are guaranteed present ---- */
  useEffect(() => {
    const stage = stageRef.current, layer = layerRef.current;
    if (!stage || !layer) return;
    const sc = createGameScene(stage, layer, {
      onPick: (k) =>
        setPicks((p) => {
          const i = p.indexOf(k);
          if (i >= 0) return p.filter((x) => x !== k);
          return p.length >= 3 ? [...p.slice(1), k] : [...p, k];
        }),
    });
    sceneRef.current = sc;
    sc.load(level, initialState(level));
    requestAnimationFrame(() => sc.resize());
    return () => { sc.dispose(); sceneRef.current = null; };
  }, [level]);

  useEffect(() => {
    sceneRef.current?.update(state, picks, solvedNow, freshKey, level.target);
  }, [state, picks, solvedNow, freshKey, level.target]);

  useEffect(() => {
    if (!freshKey) return;
    const t = setTimeout(() => setFreshKey(null), 900);
    return () => clearTimeout(t);
  }, [freshKey]);

  const ready = useMemo(
    () => (frozen ? [] : TOOLS.filter((t) => t.ok(state, picks))),
    [state, picks, frozen],
  );

  const playTool = useCallback(
    (t: Tool) => {
      if (frozen) return;
      const before = movesLeft(state, level, level.budget - moves);
      const { state: next, result } = t.run(state, picks, level);
      const gain = gainedKeys(state, next);
      const nudge = nudgeFor(state, picks, t, gain, level);

      setUndoStack((u) => [...u, { state, moves }]);
      setState(next);
      setMoves((m) => m + 1);
      setLog((l) => [...l, { move: moves + 1, result, state: next }]);
      setPicks([]);
      setFreshKey(result.freshKey);

      const after = movesLeft(next, level, level.budget - moves - 1);
      if (after === Infinity && before < Infinity) {
        setToast({
          text: "That move closed the door — the gold length is no longer reachable inside the moves you have left. <b>Undo</b> costs nothing.",
          warn: true,
        });
      } else if (before < Infinity && after >= before) {
        setToast({
          text: `No closer — still ${after} move${after > 1 ? "s" : ""} away, one fewer to spend. <b>Undo</b> if you like.`,
          warn: true,
        });
      } else if (nudge) {
        setToast({ text: `That works, and the answer is right. ${nudge}` });
      } else setToast(null);

      if (isSolved(next, level)) {
        setEnded(true);
        onSolved(moves + 1);
      } else if (moves + 1 >= level.budget) {
        setToast({
          text: `<b>Out of moves.</b> Happens. There is a way through in ${level.par}. Undo a step and look again.`,
          warn: true,
        });
      }
    },
    [frozen, state, picks, moves, level, onSolved],
  );

  const undo = useCallback(() => {
    setUndoStack((u) => {
      if (!u.length) return u;
      const last = u[u.length - 1];
      setState(last.state);
      setMoves(last.moves);
      setLog((l) => l.slice(0, -1));
      setPicks([]);
      setFreshKey(null);
      setEnded(false);
      setToast(null);
      return u.slice(0, -1);
    });
  }, []);

  const status = (() => {
    if (!picks.length) return { tone: "text-fig-dim", node: <>Tap three points.</> };
    if (picks.length < 3)
      return { tone: "text-fig-dim", node: <>{3 - picks.length} more.</> };
    if (ready.length)
      return {
        tone: "text-fig-known",
        node: (
          <>
            This triangle is ready for{" "}
            {ready.map((t, i) => (
              <span key={t.name}>
                {i > 0 && " or "}
                <b className="font-medium text-fig-ink">{t.name}</b>
              </span>
            ))}
          </>
        ),
      };
    return { tone: "text-fig-scratch", node: <>Nothing fits these three yet.</> };
  })();

  // Every length the level handed you plus every one your moves have won,
  // with the target held open until it is found. Sorted so the givens sit
  // above what you derived from them.
  const ledgerRows: LedgerRow[] = (() => {
    const targetKey = [level.target[0], level.target[1]].sort().join("|");
    const givenKeys = new Set(
      level.lens.map((e) => [e[0], e[1]].sort().join("|")),
    );
    const rows = Object.entries(state.knownLen)
      .filter(([k]) => k !== targetKey)
      .map(([k, v]) => {
        const [a, b] = k.split("|");
        return {
          id: k,
          label: `${nm(a)}${nm(b)}`,
          value: fmtPlain(v),
          state: (givenKeys.has(k) ? "given" : "found") as LedgerRow["state"],
        };
      });
    rows.sort((a, b) => Number(a.state === "found") - Number(b.state === "found"));
    const found = state.knownLen[targetKey];
    rows.push({
      id: targetKey,
      label: `${nm(level.target[0])}${nm(level.target[1])}`,
      value: found === undefined ? "?" : fmtPlain(found),
      state: found === undefined ? "target" : "found",
    });
    return rows;
  })();

  const answer = getLen(state, level.target[0], level.target[1]);
  const over = moves > level.par;
  const isLast = levelIndex + 1 >= LEVELS.length;
  // Mirrors the original's `newly`: did beating this one open the next?
  const newlyUnlocked = !isLast && levelIndex + 1 >= unlockedAtStart;

  return (
    <div className="game-stage relative h-[calc(100dvh-var(--rail-h))] overflow-hidden text-fig-ink">
      <div ref={stageRef} className="absolute inset-0 touch-none">
        <div ref={layerRef} className="game-layer" />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-3.5 bg-gradient-to-b from-fig-ground via-fig-ground to-transparent p-4">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to levels"
          className="press pointer-events-auto flex size-9 items-center justify-center rounded-lg border border-fig-rule bg-fig-paper/70 text-fig-ink backdrop-blur-sm hover:bg-fig-paper"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <b className="block text-h3 font-semibold leading-tight">{level.name}</b>
          <span className="font-mono text-eyebrow uppercase text-fig-dim">
            {String(levelIndex + 1).padStart(2, "0")} · {level.tag}
          </span>
        </div>
        <div
          className={`rounded-lg border bg-fig-paper/70 px-3 py-2 font-mono text-num tabular-nums backdrop-blur-sm ${
            moves >= level.budget ? "border-caution" : "border-fig-rule"
          }`}
        >
          <span className="text-fig-dim">moves</span>{" "}
          <b className={moves >= level.budget ? "text-caution" : "text-fig-target"}>
            {moves}
          </b>
          <span className="text-fig-dim">/{level.budget}</span>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className={`absolute left-1/2 top-20 z-20 max-w-[min(560px,92vw)] -translate-x-1/2 rounded-xl border px-4 py-3 pr-10 text-body leading-snug backdrop-blur-sm ${
            toast.warn
              ? "border-caution/50 bg-caution-soft text-caution"
              : "border-fig-rule bg-fig-paper text-fig-known"
          }`}
          style={{ "--rich-strong": "var(--fig-ink)" } as React.CSSProperties}
        >
          <Rich text={toast.text} keyPrefix={`toast-${moves}`} />
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
            className="absolute right-2 top-1.5 size-6 rounded-md opacity-55 transition-opacity duration-(--dur-press) ease-out hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* dock */}
      <div
        data-dock
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-fig-ground from-46% via-fig-ground/80 to-transparent p-3"
      >
        <div className="mx-auto w-full max-w-[760px]">
          <div className="mb-1.5 flex min-h-0 justify-center gap-1.5">
            {picks.map((k) => (
              <span
                key={k}
                className="rounded-md bg-fig-target px-2.5 py-0.5 font-mono text-body-sm font-bold text-white"
              >
                {nm(k)}
              </span>
            ))}
          </div>
          <p className={`mb-2 min-h-[19px] text-center text-body-sm ${status.tone}`}>
            {status.node}
          </p>
          <div className="pointer-events-auto grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TOOLS.map((t) => {
              const isReady = !frozen && t.ok(state, picks);
              return (
                <button
                  key={t.name}
                  type="button"
                  disabled={!isReady}
                  onClick={() => playTool(t)}
                  className={`press rounded-xl border p-2.5 text-left disabled:opacity-40 ${
                    isReady
                      ? "border-fig-target bg-brand-soft"
                      : "border-fig-rule bg-fig-paper"
                  }`}
                >
                  <b className="mb-0.5 block text-body-sm font-semibold text-fig-ink">
                    {t.name}
                  </b>
                  <i className="block text-eyebrow not-italic leading-snug text-fig-dim">
                    {isReady ? t.blurb(state, picks) : t.needs}
                  </i>
                </button>
              );
            })}
          </div>
          <div className="pointer-events-auto mt-2 flex gap-1.5">
            {[
              { label: "Undo", onClick: undo, disabled: !undoStack.length },
              { label: "Working", onClick: () => setWorkOpen((w) => !w), disabled: false },
              { label: "Start over", onClick: () => onOpenLevel(levelIndex), disabled: false },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={b.onClick}
                disabled={b.disabled}
                aria-expanded={b.label === "Working" ? workOpen : undefined}
                className="press flex-1 rounded-lg border border-fig-rule bg-fig-paper/70 p-2 text-body-sm text-fig-dim backdrop-blur-sm hover:text-fig-ink disabled:opacity-35"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* working panel — the Ledger up top, then the move-by-move record */}
      <div
        aria-hidden={!workOpen}
        className="absolute inset-y-0 right-0 z-30 w-[min(400px,88vw)] overflow-y-auto border-l border-fig-rule bg-fig-paper p-4 pb-10 transition-transform duration-(--dur-enter) ease-out motion-reduce:transition-none"
        style={{ transform: workOpen ? "none" : "translateX(100%)" }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setWorkOpen(false)}
          className="press absolute right-3 top-3 size-7 rounded-md border border-fig-rule text-fig-dim hover:text-fig-ink"
        >
          ×
        </button>
        <h4 className="mb-4 text-h3">Your working</h4>

        <Ledger
          rows={ledgerRows}
          className="mb-6"
          empty="Nothing yet — every length you win gets written down here."
        />

        <h5 className="mb-2.5 font-mono text-eyebrow uppercase text-fig-dim">
          Move by move
        </h5>
        {log.length === 0 ? (
          <p className="text-body-sm text-fig-dim">
            Your moves get written down here.
          </p>
        ) : (
          log.map((e) => (
            <div
              key={e.move}
              className="mb-3 rounded-xl border border-fig-rule bg-fig-paper-alt p-3"
            >
              <div className="mb-1.5 font-mono text-eyebrow uppercase text-fig-target">
                move {e.move} · {e.result.title}
              </div>
              <TriSvg state={e.state} keys={e.result.tri} />
              <div className="mt-2 overflow-x-auto rounded-lg bg-fig-inset p-2.5 text-center">
                <M tex={e.result.tex} />
              </div>
              <p className="mt-2 text-body-sm leading-snug text-fig-dim">
                {e.result.note}{" "}
                <b className="font-medium text-fig-ink">Now known:</b>{" "}
                {e.result.gained.join(" · ")}
              </p>
            </div>
          ))
        )}
      </div>

      {/* end card */}
      {ended && answer !== undefined && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-fig-ground/85 p-6 backdrop-blur">
          <div className="w-full max-w-[460px] rounded-xl border border-fig-rule bg-fig-paper p-7 text-center">
            <div className="mb-3.5 font-mono text-eyebrow uppercase text-fig-target">
              unlocked
            </div>
            <div className="mb-3 text-num-lg">
              <M tex={`${disp(level.target[0], level.target[1])}=${fmt(answer)}`} />
            </div>
            <h3 className="mb-2.5 text-h2 text-balance">
              {over
                ? `Found it — in ${moves}, where ${level.par} was enough.`
                : moves < level.par
                  ? `Found it in ${moves}. Under par.`
                  : `Found it in ${moves}. Exactly par.`}
            </h3>
            {over ? (
              <>
                <p className="text-body text-fig-dim">The tighter route:</p>
                <ol className="mt-3 list-decimal pl-5 text-left text-body-sm text-fig-dim">
                  {level.route.map((r) => (
                    <li key={r} className="mb-1.5">
                      {r}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-body text-fig-dim">
                Every move was a line you could write on paper.
              </p>
            )}
            {newlyUnlocked && (
              <div className="mt-4 rounded-lg border border-dashed border-fig-target/50 p-3 text-body-sm text-fig-target">
                Unlocked — {LEVELS[levelIndex + 1].name}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              {!isLast && (
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => onOpenLevel(levelIndex + 1)}
                >
                  Next
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenLevel(levelIndex)}
              >
                {over ? `Try it in ${level.par}` : "Replay"}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={onExit}>
                Levels
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
