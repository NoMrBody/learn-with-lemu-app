"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LegsFigure, RulerFigure } from "./axiom-figures";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AXIOM_BEATS, FORMAL_ASIDE, collectedBy,
  type AxiomBeat, type AxiomNo, type Line,
} from "@/lib/explainer/axioms-beats";
import {
  createAxiomsScene, type AxiomsScene, type PickState,
} from "@/lib/explainer/axioms-scene";
import { markStageProgress } from "@/app/[subject]/[topicSlug]/actions";

/**
 * The axioms explainer, ported from legacy/axioms.html.
 *
 * Same shape as components/explainer/explainer.tsx — a client component that
 * builds the 3D world once against a ref and thereafter pushes plain data in
 * through `scene.update()` — with three devices the box and pyramid
 * explainers have no use for: the formal sentence that dims and hands over to
 * a plain reading, the accent that changes with the axiom on screen, and the
 * strip of three slots that fills as each axiom is banked.
 *
 * The original's typewriter, ruled-paper background and handwriting font are
 * not ported; the reveal is, because it is the lesson's argument rather than
 * its decoration — you are shown the sentence you will meet in a textbook,
 * then told you only have to keep the idea.
 */

/**
 * The accent for each axiom. The original painted the screen from a
 * per-axiom `--ax` triple; these are the existing semantic tokens whose hues
 * already match it — blue, green, and the brand red — so there is no fourth
 * colour family to keep in step across both themes.
 */
const ACCENT: Record<AxiomNo, {
  text: string; fill: string; soft: string; hair: string; rule: string;
}> = {
  1: {
    text: "text-known", fill: "bg-known", soft: "bg-known-soft",
    hair: "border-known/40", rule: "border-known",
  },
  2: {
    text: "text-correct", fill: "bg-correct", soft: "bg-correct-soft",
    hair: "border-correct/40", rule: "border-correct",
  },
  3: {
    text: "text-brand-text", fill: "bg-brand", soft: "bg-brand-soft",
    hair: "border-brand/40", rule: "border-brand",
  },
};

/** The panel with no axiom on it — the opening and the toolkit. */
const NEUTRAL = {
  text: "text-fg", fill: "bg-line-strong", soft: "bg-surface",
  hair: "border-line", rule: "border-line-strong",
};

const accentOf = (a: AxiomNo | undefined) => (a ? ACCENT[a] : NEUTRAL);

/** How long the formal sentence stands alone before it hands over. */
const REVEAL_MS = 1500;

const REDUCED = "(prefers-reduced-motion: reduce)";

/**
 * Whether the reader has asked for less motion. globals.css already answers
 * this for CSS; the reveal below is a timer rather than a transition, so it
 * has to ask too. Subscribed rather than read once, so flipping the OS
 * setting mid-lesson takes effect, and answered `false` on the server, where
 * there is no media to match.
 */
function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(REDUCED);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

function Say({ line }: { line: Line }) {
  const cls =
    line.tone === "mono" ? "font-mono text-body text-fg"
      : line.tone === "aside" ? "text-body text-faint"
        : line.tone === "hot" ? "text-body font-medium text-brand-text"
          : "text-body text-muted";
  return <p className={cls}>{line.text}</p>;
}

/**
 * The plain reading, with the one word worth explaining wired to a tooltip.
 * Split rather than replaced: the original rewrote innerHTML to inject the
 * term, which is exactly the thing this port is meant not to do.
 */
function Plain({ beat }: { beat: AxiomBeat }) {
  const term = beat.plainTerm;
  if (!beat.plain) return null;
  if (!term || !beat.plain.includes(term.word)) return <>{beat.plain}</>;

  const [before, ...rest] = beat.plain.split(term.word);
  return (
    <>
      {before}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="cursor-help rounded-sm underline decoration-dotted underline-offset-4"
            >
              {term.word}
            </span>
          </TooltipTrigger>
          <TooltipContent>{term.meaning}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {rest.join(term.word)}
    </>
  );
}

export type AxiomsExplainerProps = {
  topicId: string;
  /** Already in progress or finished, so the mount write would be a no-op. */
  alreadyStarted: boolean;
  /** Already finished, so paging to the last slide again need not rewrite it. */
  alreadyCompleted: boolean;
  /** Where the last slide hands off to, if this is not the final stage. */
  nextStage: { href: string; title: string } | null;
  /** The subject index — where the last slide goes when there is no next stage. */
  home: { href: string; title: string };
};

export default function AxiomsExplainer({
  topicId,
  alreadyStarted,
  alreadyCompleted,
  nextStage,
  home,
}: AxiomsExplainerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<AxiomsScene | null>(null);

  const [beat, setBeat] = useState(0);
  const [pick, setPick] = useState<PickState>({
    count: 0, collinear: false, meeting: false,
  });
  // The scrubber is an integer range so the input has no float rounding to do;
  // the scene is handed the 0..1 fraction.
  const [slide, setSlide] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  // Which beat's formal sentence has already handed over. Storing the beat
  // rather than a boolean means paging away resets the reveal for free,
  // without a second state write on every slide change.
  const [revealedBeat, setRevealedBeat] = useState(-1);
  const completedRef = useRef(alreadyCompleted);
  const reduced = useReducedMotion();

  const b = AXIOM_BEATS[beat];
  const last = beat === AXIOM_BEATS.length - 1;
  const accent = accentOf(b.axiom);

  /* ---- the 3D world: created once, then fed ---- */
  useEffect(() => {
    if (!stageRef.current || !labelsRef.current) return;
    const scene = createAxiomsScene(stageRef.current, labelsRef.current, setPick);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  /* ---- push the current beat into the scene ---- */
  useEffect(() => {
    sceneRef.current?.update({
      figure: b.figure,
      slide: slide / 1000,
      resetKey,
    });
  }, [b.figure, slide, resetKey]);

  /* ---- the formal sentence hands over to the plain one ---- */
  const revealed = reduced || revealedBeat === beat;
  useEffect(() => {
    if (!b.formal || reduced) return;
    const t = setTimeout(() => setRevealedBeat(beat), REVEAL_MS);
    return () => clearTimeout(t);
  }, [beat, b.formal, reduced]);

  /* ---- mark the stage started ---- */
  useEffect(() => {
    if (alreadyStarted) return;
    void markStageProgress({ topicId, stageType: "explainer", status: "in_progress" });
  }, [topicId, alreadyStarted]);

  const go = useCallback((next: number) => {
    const i = Math.max(0, Math.min(AXIOM_BEATS.length - 1, next));
    setBeat(i);
    // Both belong to the figure, not the reader, so they start over with it.
    setSlide(0);
    setPick({ count: 0, collinear: false, meeting: false });

    // Reaching the last slide is what completes the stage. Guarded so paging
    // back and forth across the end doesn't rewrite it every time.
    if (i === AXIOM_BEATS.length - 1 && !completedRef.current) {
      completedRef.current = true;
      void markStageProgress({
        topicId,
        stageType: "explainer",
        status: "completed",
        details: { beat: i },
      });
    }
  }, [topicId]);

  /* ---- what the figure has been shown to do ---- */
  const done =
    b.figure === "pick3" ? pick.count === 3 && !pick.collinear
      : b.figure === "pick2OnPlane" ? pick.count === 2
        : b.figure === "planeSlide" ? pick.meeting
          : false;
  const stuck = b.figure === "pick3" && pick.collinear;
  const body = done && b.bodyDone ? b.bodyDone : b.body;
  const hint = (done && b.hintDone) || b.hint;
  const collected = collectedBy(beat);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        ref={stageRef}
        className={`explainer-stage relative min-h-0 flex-1 touch-none overflow-hidden ${
          b.control === "reset" && !done ? "cursor-crosshair" : ""
        }`}
      >
        <div ref={labelsRef} className="explainer-labels" />
        <p
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-fig-rule bg-fig-paper/70 px-3 py-1 font-mono text-eyebrow uppercase text-fig-dim backdrop-blur-sm transition-opacity duration-500 ease-out ${
            hint ? "opacity-100" : "opacity-0"
          }`}
        >
          {hint ?? ""}
        </p>
      </div>

      <div className="flex-none border-t border-line bg-surface px-5 py-5 lg:flex lg:w-[38%] lg:max-w-[440px] lg:items-center lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-8">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
          {/* The three slots the original called the pocket. */}
          <div className="flex items-center gap-1.5">
            <ol className="flex list-none gap-1.5" aria-label="Axioms collected">
              {([1, 2, 3] as const).map((n) => {
                const got = collected.includes(n);
                return (
                  <li
                    key={n}
                    aria-label={`Axiom ${n}${got ? ", collected" : ", not yet"}`}
                    className={`flex size-6 items-center justify-center rounded-lg border font-mono text-eyebrow transition-all duration-(--dur-enter) ease-out ${
                      got
                        ? `${ACCENT[n].fill} ${ACCENT[n].rule} text-brand-on`
                        : "border-dashed border-line-strong text-faint"
                    }`}
                  >
                    {n}
                  </li>
                );
              })}
            </ol>
            <span className="ml-1 font-mono text-eyebrow uppercase text-faint">
              axioms collected
            </span>
          </div>

          {/* Slide progress: a segment per beat, plus the count in mono so the
              reader knows how much is left without counting dashes. */}
          <div className="flex items-center gap-3">
            <ol className="flex flex-1 list-none gap-1" aria-label="Slide progress">
              {AXIOM_BEATS.map((_, i) => (
                <li
                  key={i}
                  aria-current={i === beat ? "step" : undefined}
                  className={`h-1 flex-1 rounded-full transition-colors duration-(--dur-enter) ease-out ${
                    i < beat ? "bg-correct" : i === beat ? "bg-brand" : "bg-line-strong"
                  }`}
                />
              ))}
            </ol>
            <span className="font-mono text-eyebrow tabular-nums text-faint">
              {String(beat + 1).padStart(2, "0")}/
              {String(AXIOM_BEATS.length).padStart(2, "0")}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {b.eyebrow && (
              <p className={`font-mono text-eyebrow uppercase ${accent.text}`}>
                {b.eyebrow}
              </p>
            )}
            {b.title && <h2 className="text-h2">{b.title}</h2>}

            {b.formal && (
              <>
                <div
                  className={`border-l-2 border-fg pl-4 transition-[opacity,filter] duration-(--dur-celebrate) ease-out ${
                    revealed ? "opacity-30 blur-[0.4px]" : "opacity-100"
                  }`}
                >
                  <p className="text-body-lg">{b.formal}</p>
                  {b.symbol && (
                    <p className="mt-1.5 font-mono text-body-sm text-muted">{b.symbol}</p>
                  )}
                </div>
                <p
                  className={`text-body-sm transition-opacity duration-(--dur-enter) ease-out ${
                    accent.text
                  } ${revealed ? "opacity-100" : "opacity-0"}`}
                >
                  {FORMAL_ASIDE}
                </p>
                <div
                  className={`rounded-r-xl border-l-2 px-4 py-3 text-body-lg font-semibold transition-all duration-(--dur-enter) ease-out ${accent.rule} ${accent.soft} ${
                    revealed ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
                  }`}
                >
                  <Plain beat={b} />
                </div>
              </>
            )}

            {b.panelFigure === "legs" && <LegsFigure />}
            {b.panelFigure === "ruler" && <RulerFigure />}

            {b.cards && (
              <ul className="flex list-none flex-col gap-1.5">
                {b.cards.map((c) => (
                  <li
                    key={c.mark}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${ACCENT[c.axiom].hair} ${ACCENT[c.axiom].soft}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`font-mono text-body font-semibold ${ACCENT[c.axiom].text}`}
                    >
                      {c.mark}
                    </span>
                    <span className="text-body-sm">
                      {c.lead}
                      <br />
                      <b className="font-semibold">{c.then}</b>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex min-h-[42px] flex-col gap-2">
              {body.map((line, i) => (
                <Say key={i} line={line} />
              ))}
              {stuck && (
                <p className="rounded-xl bg-caution-soft px-4 py-3 text-body-sm text-caution">
                  {b.warn}
                </p>
              )}
              {b.note && (
                <p
                  className={`rounded-xl px-4 py-3 text-body-sm ${accent.soft} ${accent.text}`}
                >
                  {b.note}
                </p>
              )}
            </div>
          </div>

          <div className="min-h-[50px]">
            {b.control === "reset" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetKey((k) => k + 1)}
              >
                Try again
              </Button>
            )}
            {b.control === "slide" && (
              <div className="flex items-center gap-3">
                <span className="whitespace-nowrap font-mono text-eyebrow uppercase text-muted">
                  apart
                </span>
                <input
                  type="range"
                  aria-label="Move plane β toward plane α"
                  min={0}
                  max={1000}
                  value={slide}
                  onChange={(e) => {
                    sceneRef.current?.stopSpin();
                    setSlide(Number(e.target.value));
                  }}
                  className="h-8 min-w-0 flex-1 accent-(--lm-brand)"
                />
                <span className="whitespace-nowrap font-mono text-eyebrow uppercase text-muted">
                  through
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2.5">
            {last ? (
              <>
                <Button type="button" variant="outline" size="lg" onClick={() => go(0)}>
                  Start again
                </Button>
                <Button asChild size="lg" className="flex-1">
                  <Link href={nextStage ? nextStage.href : home.href}>
                    {nextStage ? `Next: ${nextStage.title} →` : `Back to ${home.title} →`}
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => go(beat - 1)}
                  disabled={beat === 0}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="flex-1"
                  onClick={() => go(beat + 1)}
                >
                  Next
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
