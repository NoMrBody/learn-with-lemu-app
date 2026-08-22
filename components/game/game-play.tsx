"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { M } from "@/components/explainer/math";
import { Rich } from "@/lib/problems/rich";
import TriSvg from "./tri-svg";
import { LEVELS, type Level } from "@/lib/game/levels";
import {
  TOOLS, disp, fmt, gainedKeys, getLen, initialState, isSolved, movesLeft,
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
 * The stage is a sheet of light paper in both themes: the figure's palette
 * (dark ink labels, blue and red segments over a pale grid) is authored for
 * a light ground. Everything that floats on top of it is therefore light in
 * both themes too, rather than following the app's dark tokens.
 */

type Toast = { text: string; warn?: boolean } | null;
type LogEntry = { move: number; result: MoveResult; state: GameState };

const INK = "#14181A", DIM = "#5A6560", RULE = "#DCE3E0";

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
    if (!picks.length) return { color: DIM, node: <>Tap three points.</> };
    if (picks.length < 3) return { color: DIM, node: <>{3 - picks.length} more.</> };
    if (ready.length)
      return {
        color: "#2340C4",
        node: (
          <>
            This triangle is ready for{" "}
            {ready.map((t, i) => (
              <span key={t.name}>
                {i > 0 && " or "}
                <b style={{ color: INK, fontWeight: 500 }}>{t.name}</b>
              </span>
            ))}
          </>
        ),
      };
    return { color: "#9A6614", node: <>Nothing fits these three yet.</> };
  })();

  const answer = getLen(state, level.target[0], level.target[1]);
  const over = moves > level.par;
  const isLast = levelIndex + 1 >= LEVELS.length;
  // Mirrors the original's `newly`: did beating this one open the next?
  const newlyUnlocked = !isLast && levelIndex + 1 >= unlockedAtStart;

  return (
    <div
      className="game-stage relative h-[calc(100dvh-2.5rem)] overflow-hidden"
      style={{ color: INK }}
    >
      <div ref={stageRef} className="absolute inset-0 touch-none">
        <div ref={layerRef} className="game-layer" />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-3.5 bg-gradient-to-b from-[#F2F4F3] via-[#F2F4F3] to-transparent p-4">
        <button
          type="button"
          onClick={onExit}
          aria-label="Back to levels"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg border bg-white/70 text-lg"
          style={{ borderColor: RULE }}
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <b className="block text-xl font-normal leading-tight">{level.name}</b>
          <span className="font-mono text-[10.5px] tracking-[0.14em]" style={{ color: DIM }}>
            {String(levelIndex + 1).padStart(2, "0")} · {level.tag}
          </span>
        </div>
        <div
          className="rounded-lg border bg-white/70 px-3 py-2 font-mono text-[13px]"
          style={{ borderColor: moves >= level.budget ? "#9A6614" : RULE }}
        >
          moves{" "}
          <b style={{ color: moves >= level.budget ? "#9A6614" : "#E8442A" }}>{moves}</b>/
          {level.budget}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="absolute left-1/2 top-20 z-20 max-w-[min(560px,92vw)] -translate-x-1/2 rounded-xl border px-4 py-3 pr-10 text-[14.5px] leading-snug shadow-lg"
          style={
            {
              "--rich-strong": "#14181A",
              ...(toast.warn
                ? { background: "#FDF3E2", borderColor: "#F0D9AC", color: "#8C3320" }
                : { background: "#FFFFFF", borderColor: "#BFC9DF", color: "#2340C4" }),
            } as unknown as CSSProperties
          }
        >
          <Rich text={toast.text} keyPrefix={`toast-${moves}`} />
          <button
            type="button" aria-label="Dismiss" onClick={() => setToast(null)}
            className="absolute right-2 top-1.5 h-6 w-6 opacity-55 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* dock */}
      <div
        data-dock
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#F2F4F3] from-46% via-[#F2F4F3]/80 to-transparent p-3"
      >
        <div className="mx-auto w-full max-w-[760px]">
          <div className="mb-1.5 flex min-h-0 justify-center gap-1.5">
            {picks.map((k) => (
              <span
                key={k}
                className="rounded-md px-2.5 py-0.5 font-mono text-[13px] font-bold text-white"
                style={{ background: "#E8442A" }}
              >
                {nm(k)}
              </span>
            ))}
          </div>
          <p className="mb-2 min-h-[19px] text-center text-[13.5px]" style={{ color: status.color }}>
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
                  className="rounded-xl border p-2.5 text-left transition-colors disabled:opacity-40"
                  style={{
                    borderColor: isReady ? "#E8442A" : RULE,
                    background: isReady ? "#FDECE8" : "#FFFFFF",
                    color: INK,
                  }}
                >
                  <b className="mb-0.5 block text-[13px] font-bold">{t.name}</b>
                  <i className="block text-[11px] not-italic leading-snug" style={{ color: DIM }}>
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
                type="button" onClick={b.onClick} disabled={b.disabled}
                className="flex-1 rounded-lg border bg-white/70 p-2 text-[12.5px] disabled:opacity-35"
                style={{ borderColor: RULE, color: DIM }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* working panel */}
      <div
        className="absolute bottom-0 right-0 top-0 z-30 w-[min(400px,88vw)] overflow-y-auto border-l bg-white p-4 pb-10 transition-transform"
        style={{ borderColor: RULE, transform: workOpen ? "none" : "translateX(100%)" }}
      >
        <button
          type="button" aria-label="Close" onClick={() => setWorkOpen(false)}
          className="absolute right-3 top-3 h-7 w-7 rounded-lg border"
          style={{ borderColor: RULE }}
        >
          ×
        </button>
        <h4 className="mb-3.5 text-[22px] font-normal">Your working</h4>
        {log.length === 0 ? (
          <p className="text-[14.5px]" style={{ color: DIM }}>
            Your moves get written down here.
          </p>
        ) : (
          log.map((e) => (
            <div
              key={e.move}
              className="mb-3 rounded-xl border p-3"
              style={{ borderColor: RULE, background: "#FBFCFB" }}
            >
              <div
                className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em]"
                style={{ color: "#E8442A" }}
              >
                move {e.move} · {e.result.title}
              </div>
              <TriSvg state={e.state} keys={e.result.tri} />
              <div
                className="mt-2 overflow-x-auto rounded-lg p-2.5 text-center"
                style={{ background: "#EBEFEC" }}
              >
                <M tex={e.result.tex} />
              </div>
              <p className="mt-2 text-[13.5px] leading-snug" style={{ color: DIM }}>
                {e.result.note} <b style={{ color: INK, fontWeight: 500 }}>Now known:</b>{" "}
                {e.result.gained.join(" · ")}
              </p>
            </div>
          ))
        )}
      </div>

      {/* end card */}
      {ended && answer !== undefined && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(242,244,243,0.88)] p-6 backdrop-blur">
          <div
            className="w-full max-w-[460px] rounded-2xl border bg-white p-7 text-center shadow-2xl"
            style={{ borderColor: RULE }}
          >
            <div
              className="mb-3.5 font-mono text-[10.5px] uppercase tracking-[0.2em]"
              style={{ color: "#E8442A" }}
            >
              unlocked
            </div>
            <div className="mb-3 text-3xl">
              <M tex={`${disp(level.target[0], level.target[1])}=${fmt(answer)}`} />
            </div>
            <h3 className="mb-2.5 text-[25px] font-normal leading-tight">
              {over
                ? `Found it — in ${moves}, where ${level.par} was enough.`
                : moves < level.par
                  ? `Found it in ${moves}. Under par.`
                  : `Found it in ${moves}. Exactly par.`}
            </h3>
            {over ? (
              <>
                <p className="text-[15.5px]" style={{ color: DIM }}>The tighter route:</p>
                <ol
                  className="mt-3 list-decimal pl-5 text-left text-[14.5px]"
                  style={{ color: DIM }}
                >
                  {level.route.map((r) => <li key={r} className="mb-1.5">{r}</li>)}
                </ol>
              </>
            ) : (
              <p className="text-[15.5px]" style={{ color: DIM }}>
                Every move was a line you could write on paper.
              </p>
            )}
            {newlyUnlocked && (
              <div
                className="mt-4 rounded-lg border border-dashed p-3 text-sm"
                style={{ borderColor: "rgba(232,68,42,.45)", color: "#E8442A" }}
              >
                Unlocked — {LEVELS[levelIndex + 1].name}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              {!isLast && (
                <button
                  type="button" onClick={() => onOpenLevel(levelIndex + 1)}
                  className="flex-1 rounded-lg p-3.5 text-[14.5px] font-bold text-white"
                  style={{ background: "#E8442A" }}
                >
                  Next
                </button>
              )}
              <button
                type="button" onClick={() => onOpenLevel(levelIndex)}
                className="flex-1 rounded-lg border p-3.5 text-[14.5px]"
                style={{ borderColor: RULE }}
              >
                {over ? `Try it in ${level.par}` : "Replay"}
              </button>
              <button
                type="button" onClick={onExit}
                className="flex-1 rounded-lg border p-3.5 text-[14.5px]"
                style={{ borderColor: RULE }}
              >
                Levels
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
