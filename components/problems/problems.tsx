"use client";

import "katex/dist/katex.min.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { M } from "@/components/explainer/math";
import TriBoard from "./tri-board";
import { Rich } from "@/lib/problems/rich";
import { PROBLEMS, type Problem } from "@/lib/problems/data";

/** Named so the callback below does not reference `problem` in a type position,
 *  which the exhaustive-deps rule reads as a real dependency. */
type AnswerOption = Problem["options"][number];
import { nm, shuffled, type Points } from "@/lib/problems/geometry";
import { createProblemScene, type ProblemScene, type Tri3 } from "@/lib/problems/scene";
import { markStageProgress } from "@/app/[subject]/[topicSlug]/actions";

type Mode = "gate" | "try" | "walk";

export type ProblemsProps = {
  topicId: string;
  alreadyStarted: boolean;
  /** Problem ids already solved, restored from user_progress.details. */
  initialSolved: readonly string[];
  /** Where this stage hands off to once every problem is solved. */
  nextStage: { href: string; title: string } | null;
};

export default function Problems({
  topicId, alreadyStarted, initialSolved, nextStage,
}: ProblemsProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ProblemScene | null>(null);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("gate");
  const [shown, setShown] = useState(0);
  const [answered, setAnswered] = useState<Record<number, boolean>>({});
  const [wrongAsk, setWrongAsk] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState(0);
  const [optionState, setOptionState] = useState<Record<string, "right" | "wrong">>({});
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const [boards, setBoards] = useState<Tri3[]>([]);
  const [solved, setSolved] = useState<string[]>([...initialSolved]);
  const [hint3d, setHint3d] = useState(true);

  const problem: Problem = PROBLEMS[idx];
  const points: Points = useMemo(() => problem.pts(), [problem]);
  const allDone = solved.length >= PROBLEMS.length;

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
    sceneRef.current?.setShown(shown);
  }, [shown]);

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
      status: solved.length >= PROBLEMS.length ? "completed" : "in_progress",
      details: { solved },
    });
  }, [solved, topicId]);

  /* ---- navigation ---- */
  const openProblem = useCallback((i: number) => {
    setIdx(((i % PROBLEMS.length) + PROBLEMS.length) % PROBLEMS.length);
    setMode("gate");
    setShown(0);
    setAnswered({});
    setWrongAsk({});
    setAttempts(0);
    setOptionState({});
    setVerdict(null);
    setBoards([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const advance = useCallback(() => {
    if (shown > 0 && problem.steps[shown - 1].ask && !answered[shown - 1]) return;
    if (shown >= problem.steps.length) {
      openProblem(idx + 1);
      return;
    }
    const next = shown + 1;
    setShown(next);
    const step = problem.steps[next - 1];
    sceneRef.current?.highlight(step.board ?? null);
    if (next === problem.steps.length) recordSolved(problem.id);
    requestAnimationFrame(() =>
      stepsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  }, [shown, problem, answered, idx, openProblem, recordSolved]);

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
      const waiting = !!problem.steps[shown - 1]?.ask && !answered[shown - 1];
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
    return {
      kind: "advance",
      label:
        idx + 1 < PROBLEMS.length
          ? `Next problem: ${PROBLEMS[idx + 1].tab}`
          : "Back to the start",
      ghost: true,
      hint: "",
    };
  })();

  const toolsGot = new Set(problem.steps.slice(0, shown).map((s) => s.tool));

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        ref={stageRef}
        className="problem-stage relative h-[44dvh] min-h-[250px] flex-none touch-none overflow-hidden lg:sticky lg:top-0 lg:h-[calc(100dvh-2.5rem)] lg:flex-1 lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800"
      >
        <div ref={layerRef} className="problem-layer" />
        <p
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 transition-opacity duration-500 ${
            hint3d ? "opacity-100" : "opacity-0"
          }`}
        >
          drag to turn · tap three points
        </p>
      </div>

      <div className="w-full max-w-[660px] flex-none px-5 py-10 lg:max-w-[620px] lg:flex-[0_0_48%] lg:overflow-y-auto lg:px-10">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-zinc-500">
          Solved problems
        </p>
        <h1 className="mt-3 text-[clamp(28px,5.4vw,40px)] font-bold leading-none tracking-[-0.028em]">
          {idx === 0 ? "Nothing here is hard." : `${problem.tab}.`}
        </h1>
        <p className="mt-3 max-w-[46ch] text-zinc-600 dark:text-zinc-400">
          Every stereometry problem is a{" "}
          <b className="font-semibold text-foreground">short sequence of things you already know</b>.
          We take them one at a time, and you collect the tool each step needs.
        </p>

        {/* picker */}
        <div
          role="tablist"
          aria-label="Problems"
          className="mt-7 flex flex-wrap border-b border-zinc-200 dark:border-zinc-800"
        >
          {PROBLEMS.map((p, i) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              aria-selected={i === idx}
              onClick={() => openProblem(i)}
              className={`-mb-px border-b-2 px-3.5 pb-2.5 pt-2 text-sm transition-colors ${
                i === idx
                  ? "border-rail-current font-semibold text-foreground"
                  : "border-transparent text-zinc-500 hover:text-foreground"
              }`}
            >
              {p.tab}
              {solved.includes(p.id) && (
                <span className="ml-1.5 text-xs text-rail-done" aria-label="solved">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>

        {/* statement */}
        <div className="mt-6">
          <p className="text-[19px] leading-snug">
            <Rich text={problem.statement} keyPrefix={`${problem.id}-stmt`} />
          </p>
          <div className="mt-4 flex flex-wrap items-baseline gap-4 border-t border-zinc-200 pt-3.5 dark:border-zinc-800">
            {problem.given.map((g, i) => (
              <span key={i} className="text-zinc-600 dark:text-zinc-400">
                <Rich text={g} keyPrefix={`${problem.id}-g${i}`} />
              </span>
            ))}
            <span className="block w-full font-medium text-rail-current">
              find <Rich text={problem.ask} keyPrefix={`${problem.id}-ask`} />
            </span>
          </div>
          <p className="mt-5 border-l-2 border-[#E39A22] pl-4 text-[15.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            <b className="font-semibold text-foreground">The figure is not finished.</b>{" "}
            <Rich text={problem.incomplete} keyPrefix={`${problem.id}-inc`} />
          </p>
        </div>

        {/* gate */}
        {mode === "gate" && (
          <div className="mt-7">
            <p className="text-[19px] font-bold tracking-[-0.018em]">Have a go first?</p>
            <div className="mt-3.5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setMode("try")}
                className="rounded-xl border border-zinc-200 px-4 py-4 text-left transition-colors hover:border-rail-current dark:border-zinc-800"
              >
                <b className="block text-[17px] font-bold tracking-[-0.015em]">Let me try</b>
                <span className="block text-[14.5px] text-zinc-600 dark:text-zinc-400">
                  Turn the figure, pull out triangles, then pick your answer.
                </span>
              </button>
              <button
                type="button"
                onClick={startWalk}
                className="rounded-xl border border-zinc-200 px-4 py-4 text-left transition-colors hover:border-rail-current dark:border-zinc-800"
              >
                <b className="block text-[17px] font-bold tracking-[-0.015em]">
                  Walk me through it
                </b>
                <span className="block text-[14.5px] text-zinc-600 dark:text-zinc-400">
                  One step at a time, collecting the tool each step needs.
                </span>
              </button>
            </div>
          </div>
        )}

        {/* have-a-go options */}
        {mode === "try" && (
          <div className="mt-7">
            <p className="text-[19px] font-bold tracking-[-0.018em]">What did you get?</p>
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              {shuffled(problem.options, problem.id).map((o) => {
                const st = optionState[o.v];
                return (
                  <button
                    key={o.v}
                    type="button"
                    disabled={!!st}
                    onClick={() => pickAnswer(o)}
                    className={`rounded-xl border px-2.5 py-4 text-lg transition-colors ${
                      st === "right"
                        ? "border-rail-done bg-rail-done/10"
                        : st === "wrong"
                          ? "border-zinc-200 opacity-40 dark:border-zinc-800"
                          : "border-zinc-200 hover:border-rail-done dark:border-zinc-800"
                    }`}
                  >
                    <M tex={o.v} />
                  </button>
                );
              })}
            </div>
            {verdict && (
              <p
                className={`mt-4 border-l-2 pl-4 leading-relaxed text-zinc-600 dark:text-zinc-400 ${
                  verdict.ok ? "border-rail-done" : "border-rail-current"
                }`}
              >
                <Rich text={verdict.text} keyPrefix={`${problem.id}-verdict-${attempts}`} />
              </p>
            )}
            {!verdict && (
              <p className="mt-3 text-center text-[13.5px] text-zinc-500">
                Take your time. Pull out any triangle you like first.
              </p>
            )}
          </div>
        )}

        {/* toolbelt */}
        {mode === "walk" && (
          <div className="mt-7">
            <h3 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-500">
              Tools this one needs
            </h3>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {problem.tools.map((t) => (
                <div
                  key={t}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13.5px] transition-colors ${
                    toolsGot.has(t)
                      ? "border-rail-done font-semibold text-rail-done"
                      : "border-zinc-200 text-zinc-500 dark:border-zinc-800"
                  }`}
                >
                  <i
                    className={`h-1.5 w-1.5 flex-none rounded-full ${
                      toolsGot.has(t) ? "bg-rail-done" : "bg-zinc-300 dark:bg-zinc-700"
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
            <h3 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#8F5F12]">
              Your scratchpad
            </h3>
            <div className="mt-2.5 flex flex-col gap-2.5">
              {boards.map((keys) => (
                <div key={keys.join("")}>
                  <div className="mb-1.5 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#8F5F12]">
                    {keys.map(nm).join("")} — true shape, given lengths only
                    <button
                      type="button"
                      aria-label={`Remove ${keys.map(nm).join("")}`}
                      onClick={() => {
                        setBoards((b) => b.filter((x) => x.join("") !== keys.join("")));
                        sceneRef.current?.highlight(null);
                      }}
                      className="ml-auto text-zinc-500 hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>
                  <TriBoard
                    points={points}
                    keys={keys as unknown as [string, string, string]}
                    ink="#9A6614"
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
                    <span className="font-mono text-xs text-zinc-500">{i + 1}</span>
                    <span className="text-xl font-bold tracking-[-0.02em]">{s.t}</span>
                  </div>

                  {waiting && s.ask ? (
                    <div className="mt-2.5 border-l-2 border-rail-done pl-4">
                      <p className="font-bold tracking-[-0.015em]">
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
                                  setAnswered((a) => ({ ...a, [i]: true }));
                                } else {
                                  setWrongAsk((w) => ({ ...w, [key]: o.why }));
                                }
                              }}
                              className={`rounded-lg border px-3.5 py-2.5 text-left text-[15.5px] transition-colors ${
                                wrong
                                  ? "border-zinc-200 opacity-45 dark:border-zinc-800"
                                  : "border-zinc-200 hover:border-rail-done dark:border-zinc-800"
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
                          <p key={k} className="mt-3 text-[15.5px] text-rail-current">
                            <Rich text={why} keyPrefix={`${problem.id}-why${i}`} />
                          </p>
                        ))}
                      <button
                        type="button"
                        onClick={() => setAnswered((a) => ({ ...a, [i]: true }))}
                        className="mt-3 font-mono text-[11px] tracking-[0.1em] text-zinc-500 hover:underline"
                      >
                        Skip — just show me
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="mt-2.5 leading-relaxed text-zinc-600 dark:text-zinc-400">
                        <Rich text={s.p} keyPrefix={`${problem.id}-p${i}`} />
                      </p>
                      {s.tex && (
                        <div className="my-4 overflow-x-auto text-center text-[19px] text-[#2340C4]">
                          <M tex={s.tex} />
                        </div>
                      )}
                      {s.board && (
                        <div className="mb-3.5">
                          <div className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500">
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
                        <p className="text-[15.5px] text-zinc-600 dark:text-zinc-400">
                          <Rich text={s.note} keyPrefix={`${problem.id}-n${i}`} />
                        </p>
                      )}
                      <span className="mt-2 inline-flex items-center gap-1.5 font-mono text-[13px] font-medium text-rail-done">
                        {s.got} — now on the figure
                      </span>
                    </>
                  )}
                </div>
              );
            })}

            {shown >= problem.steps.length && (
              <div className="mt-7 border-t-2 border-rail-current pt-5">
                <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-rail-current">
                  answer
                </div>
                <div className="mb-3.5 mt-3 text-3xl">
                  <M tex={problem.answer} />
                </div>
                <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
                  <Rich text={problem.why} keyPrefix={`${problem.id}-why`} />
                </p>
              </div>
            )}
            <div ref={stepsEndRef} />
          </div>
        )}

        {allDone && (
          <div className="mt-6 flex flex-col gap-3 rounded-lg border border-rail-done px-4 py-4">
            <p className="text-rail-done">All four solved — this stage is complete.</p>
            {/* Only when the sticky bar is not already offering the hand-off,
                so the two never appear as duplicate buttons. */}
            {nextStage && action?.kind !== "next-stage" && (
              <Link
                href={nextStage.href}
                className="self-start rounded-lg bg-foreground px-4 py-2.5 font-medium text-background"
              >
                Next: {nextStage.title} →
              </Link>
            )}
          </div>
        )}

        {/* the one action */}
        {action && (
          <div className="sticky bottom-4 z-10 mt-7">
            {action.kind === "next-stage" && nextStage ? (
              <Link
                href={nextStage.href}
                className="block w-full rounded-xl bg-foreground px-5 py-4 text-center font-semibold text-background"
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.kind === "walk" ? startWalk : advance}
                disabled={action.disabled}
                className={`w-full rounded-xl px-5 py-4 font-semibold transition-[filter] disabled:opacity-40 ${
                  action.ghost
                    ? "border border-zinc-200 bg-background text-foreground dark:border-zinc-800"
                    : "bg-foreground text-background hover:brightness-125"
                }`}
              >
                {action.label}
              </button>
            )}
            {action.hint && (
              <p className="mt-2.5 text-center text-[13.5px] text-zinc-500">{action.hint}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
