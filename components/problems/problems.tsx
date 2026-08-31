"use client";

import "katex/dist/katex.min.css";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { M } from "@/components/explainer/math";
import TriBoard from "./tri-board";
import { Ledger, type LedgerRow } from "@/components/ledger";
import { Button } from "@/components/ui/button";
import { Rich } from "@/lib/problems/rich";
import { getProblems, type Problem } from "@/lib/problems/data";

/** Named so the callback below does not reference `problem` in a type position,
 *  which the exhaustive-deps rule reads as a real dependency. */
type AnswerOption = Problem["options"][number];
import { dist, keyOf, nice, nm, shuffled, type Points } from "@/lib/problems/geometry";
import { createProblemScene, type ProblemScene, type Tri3 } from "@/lib/problems/scene";
import { markStageProgress } from "@/app/[subject]/[topicSlug]/actions";
import { scrollBehavior } from "@/lib/reduced-motion";

type Mode = "gate" | "try" | "walk";

export type ProblemsProps = {
  topicId: string;
  /** Which problem set to run — the box and the pyramid have their own. */
  topicSlug: string;
  alreadyStarted: boolean;
  /** Problem ids already solved, restored from user_progress.details. */
  initialSolved: readonly string[];
  /** Where this stage hands off to once every problem is solved. */
  nextStage: { href: string; title: string } | null;
};

export default function Problems({
  topicId, topicSlug, alreadyStarted, initialSolved, nextStage,
}: ProblemsProps) {
  // The route renders a placeholder instead of mounting this when the set is
  // empty, so `problems[idx]` below is safe.
  const problems = useMemo(() => getProblems(topicSlug), [topicSlug]);
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ProblemScene | null>(null);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("gate");
  const [shown, setShown] = useState(0);
  /**
   * What the figure is showing, which can lag the lesson. `shown` is how far
   * the reader has got; `figShown` is how much of that construction is on the
   * solid right now, so they can step back and see it without it.
   */
  const [figShown, setFigShown] = useState(0);
  const [answered, setAnswered] = useState<Record<number, boolean>>({});
  const [wrongAsk, setWrongAsk] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState(0);
  const [optionState, setOptionState] = useState<Record<string, "right" | "wrong">>({});
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const [boards, setBoards] = useState<Tri3[]>([]);
  const [solved, setSolved] = useState<string[]>([...initialSolved]);
  const [hint3d, setHint3d] = useState(true);

  const problem: Problem = problems[idx];
  const points: Points = useMemo(() => problem.pts(), [problem]);
  const allDone = solved.length >= problems.length;

  /* ---- scene lifecycle ---- */
  useEffect(() => {
    if (!stageRef.current || !layerRef.current) return;
    const scene = createProblemScene(stageRef.current, layerRef.current, {
      onTriangle: (keys) =>
        setBoards((b) =>
          b.some((x) => [...x].sort().join("") === [...keys].sort().join("")) ? b : [...b, keys],
        ),
    });
    sceneRef.current = scene;
    const stage = stageRef.current;
    const drop = () => setHint3d(false);
    stage.addEventListener("pointerdown", drop);
    const t = setTimeout(drop, 6000);
    return () => {
      clearTimeout(t);
      stage.removeEventListener("pointerdown", drop);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Switching problems resets the figure to nothing-revealed.
  useEffect(() => {
    sceneRef.current?.load(problem, points, 0);
  }, [problem, points]);

  useEffect(() => {
    sceneRef.current?.setShown(figShown);
  }, [figShown]);

  /* ---- progress ---- */
  useEffect(() => {
    if (alreadyStarted) return;
    void markStageProgress({ topicId, stageType: "problem", status: "in_progress" });
  }, [topicId, alreadyStarted]);

  const recordSolved = useCallback((id: string) => {
    // Pure updater: React may run this during render, so the progress write
    // happens in the effect below instead. Doing it here made the server
    // action update the Router mid-render.
    setSolved((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const writtenRef = useRef(initialSolved.join(","));
  useEffect(() => {
    const key = solved.join(",");
    if (key === writtenRef.current) return;
    writtenRef.current = key;
    void markStageProgress({
      topicId,
      stageType: "problem",
      // The stage is finished only once every problem is solved.
      status: solved.length >= problems.length ? "completed" : "in_progress",
      details: { solved },
    });
  }, [solved, topicId, problems.length]);

  /**
   * A step's question answered — or waved past with "Skip". Answering the last
   * one is what finishes the problem: until then that step shows the question
   * and nothing else, so having revealed it was never the same as having read
   * it, and ticking the tab there put a ✓ on a problem still refusing to let
   * the reader leave.
   */
  const answerStep = useCallback((i: number) => {
    setAnswered((a) => ({ ...a, [i]: true }));
    if (i === problem.steps.length - 1) recordSolved(problem.id);
  }, [problem, recordSolved]);

  /* ---- navigation ---- */
  const openProblem = useCallback((i: number) => {
    setIdx(((i % problems.length) + problems.length) % problems.length);
    setMode("gate");
    setShown(0);
    setAnswered({});
    setWrongAsk({});
    setAttempts(0);
    setOptionState({});
    setVerdict(null);
    setBoards([]);
    setFigShown(0);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }, [problems.length]);

  const advance = useCallback(() => {
    if (shown > 0 && problem.steps[shown - 1].ask && !answered[shown - 1]) return;
    if (shown >= problem.steps.length) {
      openProblem(idx + 1);
      return;
    }
    const next = shown + 1;
    setShown(next);
    // The lesson moving on carries the figure with it. From there the figure
    // can be stepped back on its own, without disturbing where the reader is.
    setFigShown(next);
    const step = problem.steps[next - 1];
    sceneRef.current?.highlight(step.board ?? null);
    // A last step with nothing to answer is finished by being shown. One that
    // ends in a question is finished when the question is — see `answerStep`.
    if (next === problem.steps.length && !step.ask) recordSolved(problem.id);
    requestAnimationFrame(() =>
      stepsEndRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" }),
    );
  }, [shown, problem, answered, idx, openProblem, recordSolved]);

  /* ---- stepping the figure's construction, independently of the lesson ----
     Both directions re-aim the triangle highlight at whatever the figure is
     now showing, so the flat board beside the prose and the solid agree. */
  const boardAt = useCallback(
    (step: number) => (step > 0 ? problem.steps[step - 1]?.board ?? null : null),
    [problem],
  );

  const figureBack = useCallback(() => {
    if (figShown <= 0) return;
    const next = figShown - 1;
    setFigShown(next);
    sceneRef.current?.highlight(boardAt(next));
  }, [figShown, boardAt]);

  const figureForward = useCallback(() => {
    if (figShown >= shown) return;
    const next = figShown + 1;
    setFigShown(next);
    sceneRef.current?.highlight(boardAt(next));
  }, [figShown, shown, boardAt]);

  /** Nothing to step through if no step ever draws anything. */
  const hasConstruction = useMemo(
    () => problem.steps.some((s) => (s.add?.length ?? 0) > 0),
    [problem],
  );
  const showFigureControls = mode === "walk" && hasConstruction;

  const pickAnswer = useCallback(
    (o: AnswerOption) => {
      if (optionState[o.v]) return;
      const n = attempts + 1;
      setAttempts(n);
      if (o.ok) {
        setOptionState((s) => ({ ...s, [o.v]: "right" }));
        setVerdict({
          ok: true,
          text: `<b>That is it.</b> ${n === 1 ? "First try." : "Got there."} Want to see whether your route matched ours?`,
        });
      } else {
        setOptionState((s) => ({ ...s, [o.v]: "wrong" }));
        setVerdict({
          ok: false,
          text: `<b>Not what we got.</b> Hard to say exactly where it went, but here is one thing that could have happened. ${o.why ?? ""}`,
        });
      }
    },
    [attempts, optionState],
  );

  const startWalk = useCallback(() => {
    setMode("walk");
    setVerdict(null);
  }, []);

  /* ---- the single action button ----
     Holds a `kind` rather than a callback: embedding a handler that closes
     over the scene ref in an object built during render trips the
     react-hooks ref analysis. */
  type Action = {
    kind: "walk" | "advance" | "next-stage";
    label: string;
    hint: string;
    ghost?: boolean;
    disabled?: boolean;
  };
  /**
   * The condition `advance` refuses to move past. Every branch below has to
   * read it: a button that looks live while the handler silently returns is
   * exactly the failure this guards against, and it is only reachable on a
   * problem whose last step carries a question.
   */
  const waiting = shown > 0 && !!problem.steps[shown - 1]?.ask && !answered[shown - 1];

  const action: Action | null = (() => {
    if (mode === "gate") return null;
    if (mode === "try") {
      if (Object.values(optionState).includes("right"))
        return { kind: "walk", label: "Compare with our way", hint: "" };
      if (attempts >= 2)
        return { kind: "walk", label: "Show me how it works", hint: "" };
      return null;
    }
    if (shown === 0)
      return {
        kind: "advance",
        label: "Show me the first move",
        hint: "Or turn the figure and tap any three points first.",
      };
    if (shown < problem.steps.length) {
      return {
        kind: "advance",
        label: waiting ? "Answer above to carry on" : "Next step",
        disabled: waiting,
        hint: waiting ? "" : `Step ${shown} of ${problem.steps.length} done.`,
      };
    }
    // With every problem solved there is nowhere useful left to cycle to,
    // so the primary action becomes the hand-off to the next stage.
    if (allDone && nextStage) {
      return { kind: "next-stage", label: `Next: ${nextStage.title} →`, hint: "" };
    }
    // The last step can be waiting too. The sticky bar keeps this button in
    // view while the question it is waiting on scrolls away above, so the
    // reason has to travel with the button.
    if (waiting) {
      return {
        kind: "advance",
        label: "Answer above to carry on",
        disabled: true,
        hint: "One question left, just above.",
      };
    }
    return {
      kind: "advance",
      label:
        idx + 1 < problems.length
          ? `Next problem: ${problems[idx + 1].tab}`
          : "Back to the start",
      ghost: true,
      hint: "",
    };
  })();

  const toolsGot = new Set(problem.steps.slice(0, shown).map((s) => s.tool));

  // The Ledger: what the statement gave you, plus everything the steps so far
  // have established, plus the one length you are still after. Built here
  // rather than in the component so the ordering — given, then found in the
  // order they were won — matches how the reader got them.
  const ledgerRows: LedgerRow[] = (() => {
    const rows: LedgerRow[] = [];
    const seen = new Set<string>();
    const push = (a: string, b: string, state: LedgerRow["state"]) => {
      const id = keyOf(a, b);
      if (seen.has(id)) return;
      seen.add(id);
      rows.push({
        id,
        label: `${nm(a)}${nm(b)}`,
        value: state === "target" ? "?" : nice(dist(points, a, b)),
        state,
      });
    };
    for (const [a, b] of problem.known) push(a, b, "given");
    for (const step of problem.steps.slice(0, shown)) {
      for (const [a, b] of step.lens ?? []) push(a, b, "found");
    }
    // Once the last step has landed the target is no longer a question.
    const solvedTarget = shown >= problem.steps.length;
    const state: LedgerRow["state"] = solvedTarget ? "found" : "target";
    if (problem.targetRow) {
      // An area or an angle, not a length. The figure still marks a segment in
      // red, but printing that segment's length here would assert a number the
      // solution never works out. Replaces rather than appends: rows are keyed
      // on the id, and a step's `lens` may already have claimed this pair.
      const id = keyOf(problem.target[0], problem.target[1]);
      const at = rows.findIndex((r) => r.id === id);
      const row: LedgerRow = {
        id,
        label: problem.targetRow.label,
        value: solvedTarget ? problem.targetRow.value : "?",
        state,
      };
      if (at >= 0) rows[at] = row;
      else rows.push(row);
    } else {
      push(problem.target[0], problem.target[1], state);
    }
    return rows;
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        ref={stageRef}
        className="problem-stage relative h-[44dvh] min-h-[250px] flex-none touch-none overflow-hidden lg:sticky lg:top-0 lg:h-[calc(100dvh-var(--rail-h))] lg:flex-1 lg:border-r lg:border-line"
      >
        <div ref={layerRef} className="problem-layer" />

        {/* Stepping the construction. Both buttons stay put and grey out at
            the ends of the history — a control that vanishes is a control the
            reader has to rediscover. */}
        {showFigureControls && (
          <div className="fig-control absolute bottom-14 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-fig-rule bg-fig-paper/70 p-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={figureBack}
              disabled={figShown <= 0}
              aria-label="Step the figure back to before the last construction"
              className="flex size-7 items-center justify-center rounded-full text-fig-dim transition-colors duration-(--dur-press) ease-out hover:bg-fig-inset hover:text-fig-ink disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <span
              aria-live="polite"
              className="min-w-[11ch] text-center font-mono text-eyebrow uppercase tabular-nums text-fig-dim"
            >
              {figShown === 0
                ? "base figure"
                : `step ${figShown} of ${problem.steps.length}`}
            </span>
            <button
              type="button"
              onClick={figureForward}
              disabled={figShown >= shown}
              aria-label="Draw the next construction again"
              className="flex size-7 items-center justify-center rounded-full text-fig-dim transition-colors duration-(--dur-press) ease-out hover:bg-fig-inset hover:text-fig-ink disabled:pointer-events-none disabled:opacity-35"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        )}

        <p
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-fig-rule bg-fig-paper/70 px-3 py-1 font-mono text-eyebrow uppercase text-fig-dim backdrop-blur-sm transition-opacity duration-500 ease-out ${
            hint3d ? "opacity-100" : "opacity-0"
          }`}
        >
          drag to turn · tap three points
        </p>
      </div>

      <div className="w-full max-w-[660px] flex-none bg-bg px-5 py-10 lg:max-w-[620px] lg:flex-[0_0_48%] lg:overflow-y-auto lg:px-10">
        <p className="font-mono text-eyebrow uppercase text-muted">Solved problems</p>
        <h1 className="mt-3 text-display">
          {idx === 0 ? "Nothing here is hard." : `${problem.tab}.`}
        </h1>
        <p className="mt-4 max-w-[46ch] text-body-lg text-muted">
          Every stereometry problem is a{" "}
          <b className="font-semibold text-fg">short sequence of things you already know</b>.
          We take them one at a time, and you collect the tool each step needs.
        </p>

        {/* picker */}
        <div
          role="tablist"
          aria-label="Problems"
          className="mt-8 flex flex-wrap border-b border-line"
        >
          {problems.map((p, i) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={i === idx}
              onClick={() => openProblem(i)}
              className={`-mb-px rounded-t-md border-b-2 px-3.5 pb-2.5 pt-2 text-body-sm transition-colors duration-(--dur-state) ease-out ${
                i === idx
                  ? "border-brand font-semibold text-fg"
                  : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {p.tab}
              {solved.includes(p.id) && (
                <span className="ml-1.5 text-correct" aria-label="solved">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>

        {/* statement */}
        <div className="mt-6">
          <p className="text-body-lg leading-snug">
            <Rich text={problem.statement} keyPrefix={`${problem.id}-stmt`} />
          </p>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-line pt-3.5">
            {problem.given.map((g, i) => (
              <span key={i} className="text-body-sm text-muted">
                <Rich text={g} keyPrefix={`${problem.id}-g${i}`} />
              </span>
            ))}
            <span className="block w-full font-medium text-brand-text">
              find <Rich text={problem.ask} keyPrefix={`${problem.id}-ask`} />
            </span>
          </div>
          <p className="mt-5 border-l-2 border-fig-built pl-4 text-body leading-relaxed text-muted">
            <b className="font-semibold text-fg">The figure is not finished.</b>{" "}
            <Rich text={problem.incomplete} keyPrefix={`${problem.id}-inc`} />
          </p>
        </div>

        {/* gate */}
        {mode === "gate" && (
          <div className="mt-7">
            <h2 className="text-h3">Have a go first?</h2>
            <div className="mt-3.5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setMode("try")}
                className="press rounded-xl border border-line bg-surface px-4 py-4 text-left hover:border-brand/60 hover:bg-raised"
              >
                <b className="block text-body-lg font-semibold">Let me try</b>
                <span className="block text-body-sm text-muted">
                  Turn the figure, pull out triangles, then pick your answer.
                </span>
              </button>
              <button
                type="button"
                onClick={startWalk}
                className="press rounded-xl border border-line bg-surface px-4 py-4 text-left hover:border-brand/60 hover:bg-raised"
              >
                <b className="block text-body-lg font-semibold">Walk me through it</b>
                <span className="block text-body-sm text-muted">
                  One step at a time, collecting the tool each step needs.
                </span>
              </button>
            </div>
          </div>
        )}

        {/* have-a-go options */}
        {mode === "try" && (
          <div className="mt-7">
            <h2 className="text-h3">What did you get?</h2>
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              {shuffled(problem.options, problem.id).map((o) => {
                const st = optionState[o.v];
                return (
                  <button
                    key={o.v}
                    type="button"
                    disabled={!!st}
                    onClick={() => pickAnswer(o)}
                    className={`rounded-xl border px-2.5 py-4 text-lg transition-[background-color,border-color,box-shadow,opacity] duration-(--dur-enter) ease-out ${
                      st === "right"
                        ? "border-correct bg-correct-soft shadow-[0_0_0_4px_var(--lm-correct-soft)]"
                        : st === "wrong"
                          ? "border-caution/60 opacity-45 motion-safe:animate-[nudge_180ms_var(--ease)]"
                          : "press border-line bg-surface hover:border-correct hover:bg-raised"
                    }`}
                  >
                    <M tex={o.v} />
                  </button>
                );
              })}
            </div>
            {verdict && (
              <p
                className={`mt-4 border-l-2 pl-4 text-body leading-relaxed text-muted ${
                  verdict.ok ? "border-correct" : "border-caution"
                }`}
              >
                <Rich text={verdict.text} keyPrefix={`${problem.id}-verdict-${attempts}`} />
              </p>
            )}
            {!verdict && (
              <p className="mt-3 text-center text-body-sm text-faint">
                Take your time. Pull out any triangle you like first.
              </p>
            )}
          </div>
        )}

        {/* the Ledger — what you have, and the one thing you want */}
        {mode !== "gate" && (
          <Ledger rows={ledgerRows} className="mt-8" />
        )}

        {/* toolbelt */}
        {mode === "walk" && (
          <div className="mt-7">
            <h3 className="font-mono text-eyebrow uppercase text-muted">
              Tools this one needs
            </h3>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {problem.tools.map((t) => (
                <div
                  key={t}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-body-sm transition-colors duration-(--dur-enter) ease-out ${
                    toolsGot.has(t)
                      ? "border-correct bg-correct-soft font-semibold text-correct"
                      : "border-line text-muted"
                  }`}
                >
                  <i
                    className={`h-1.5 w-1.5 flex-none rounded-full ${
                      toolsGot.has(t) ? "bg-correct" : "bg-line-strong"
                    }`}
                  />
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* scratchpad */}
        {boards.length > 0 && (
          <div className="mt-7">
            <h3 className="font-mono text-eyebrow uppercase text-fig-scratch">
              Your scratchpad
            </h3>
            <div className="mt-2.5 flex flex-col gap-2.5">
              {boards.map((keys) => (
                <div key={keys.join("")}>
                  <div className="mb-1.5 flex items-center gap-2 font-mono text-eyebrow uppercase text-fig-scratch">
                    {keys.map(nm).join("")} — true shape, given lengths only
                    <button
                      type="button"
                      aria-label={`Remove ${keys.map(nm).join("")}`}
                      onClick={() => {
                        setBoards((b) => b.filter((x) => x.join("") !== keys.join("")));
                        sceneRef.current?.highlight(null);
                      }}
                      className="ml-auto rounded-md px-1 text-muted transition-colors duration-(--dur-press) ease-out hover:text-fg"
                    >
                      ×
                    </button>
                  </div>
                  <TriBoard
                    points={points}
                    keys={keys as unknown as [string, string, string]}
                    ink="var(--fig-scratch)"
                    givenOnly
                    known={problem.known}
                    label={`Triangle ${keys.map(nm).join("")}, true shape`}
                    onClick={() => sceneRef.current?.highlight(keys, true)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* steps */}
        {mode === "walk" && (
          <div className="mt-7">
            {problem.steps.slice(0, shown).map((s, i) => {
              const waiting = !!s.ask && !answered[i];
              return (
                <div key={i} className="mb-7">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-eyebrow tabular-nums text-faint">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-h3">{s.t}</span>
                  </div>

                  {waiting && s.ask ? (
                    <div className="mt-2.5 border-l-2 border-correct pl-4">
                      <p className="font-semibold text-fg">
                        <Rich text={s.ask.q} keyPrefix={`${problem.id}-q${i}`} />
                      </p>
                      <div className="mt-3 flex flex-col gap-1.5">
                        {shuffled(s.ask.opts, problem.id + i).map((o) => {
                          const key = `${i}:${o.v}`;
                          const wrong = wrongAsk[key];
                          return (
                            <button
                              key={o.v}
                              type="button"
                              disabled={!!wrong}
                              onClick={() => {
                                if (o.ok) {
                                  answerStep(i);
                                } else {
                                  setWrongAsk((w) => ({ ...w, [key]: o.why }));
                                }
                              }}
                              className={`rounded-lg border px-3.5 py-2.5 text-left text-body transition-[background-color,border-color,opacity] duration-(--dur-state) ease-out ${
                                wrong
                                  ? "border-caution/60 opacity-45 motion-safe:animate-[nudge_180ms_var(--ease)]"
                                  : "press border-line bg-surface hover:border-correct hover:bg-raised"
                              }`}
                            >
                              <Rich text={o.v} keyPrefix={`${problem.id}-o${i}-${o.v}`} />
                            </button>
                          );
                        })}
                      </div>
                      {Object.entries(wrongAsk)
                        .filter(([k]) => k.startsWith(`${i}:`))
                        .slice(-1)
                        .map(([k, why]) => (
                          <p key={k} className="mt-3 text-body text-caution">
                            <Rich text={why} keyPrefix={`${problem.id}-why${i}`} />
                          </p>
                        ))}
                      <button
                        type="button"
                        onClick={() => answerStep(i)}
                        className="mt-3 rounded-md font-mono text-eyebrow uppercase text-muted underline-offset-4 hover:text-fg hover:underline"
                      >
                        Skip — just show me
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-2.5 text-body leading-relaxed text-muted">
                        <Rich text={s.p} keyPrefix={`${problem.id}-p${i}`} />
                      </p>
                      {s.tex && (
                        <div className="my-4 overflow-x-auto rounded-lg border border-line bg-surface px-3 py-3 text-center text-body-lg text-fig-known">
                          <M tex={s.tex} />
                        </div>
                      )}
                      {s.board && (
                        <div className="mb-3.5">
                          <div className="mb-1.5 font-mono text-eyebrow uppercase text-muted">
                            flat, true shape
                          </div>
                          <TriBoard
                            points={points}
                            keys={s.board as unknown as [string, string, string]}
                            label={`Triangle ${s.board.map(nm).join("")}, true shape`}
                            onClick={() => sceneRef.current?.highlight(s.board!)}
                          />
                        </div>
                      )}
                      {s.note && (
                        <p className="text-body text-muted">
                          <Rich text={s.note} keyPrefix={`${problem.id}-n${i}`} />
                        </p>
                      )}
                      <span className="mt-2 inline-flex items-center gap-1.5 font-mono text-body-sm font-medium text-correct">
                        {s.got} — now on the figure
                      </span>
                    </>
                  )}
                </div>
              );
            })}

            {shown >= problem.steps.length && (
              <div className="mt-8 border-t-2 border-brand pt-5">
                <div className="font-mono text-eyebrow uppercase text-brand-text">
                  answer
                </div>
                <div className="mb-3.5 mt-3 text-num-lg">
                  <M tex={problem.answer} />
                </div>
                <p className="text-body leading-relaxed text-muted">
                  <Rich text={problem.why} keyPrefix={`${problem.id}-why`} />
                </p>
              </div>
            )}
            <div ref={stepsEndRef} />
          </div>
        )}

        {allDone && (
          <div className="mt-8 flex flex-col gap-3 rounded-xl border border-correct bg-correct-soft px-4 py-4">
            <p className="text-body font-medium text-correct">
              Every problem solved — this stage is complete.
            </p>
            {/* Only when the sticky bar is not already offering the hand-off,
                so the two never appear as duplicate buttons. */}
            {nextStage && action?.kind !== "next-stage" && (
              <Button asChild className="self-start">
                <Link href={nextStage.href}>Next: {nextStage.title} →</Link>
              </Button>
            )}
          </div>
        )}

        {/* the one action */}
        {action && (
          <div className="sticky bottom-4 z-10 mt-7">
            {action.kind === "next-stage" && nextStage ? (
              <Button asChild size="xl">
                <Link href={nextStage.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="xl"
                variant={action.ghost ? "secondary" : "primary"}
                onClick={action.kind === "walk" ? startWalk : advance}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            )}
            {action.hint && (
              <p className="mt-2.5 text-center text-body-sm text-muted">{action.hint}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
