"use client";

import "katex/dist/katex.min.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Controls from "./controls";
import {
  BEAT_GROUPS, BEAT_LABELS, beatText, getBeats, initialUserState, type UserState,
} from "@/lib/explainer/beats";
import {
  createExplainerScene, volume, type ExplainerScene, type SceneParams,
  type Solid,
} from "@/lib/explainer/scene";
import { markStageProgress } from "@/app/[subject]/[topicSlug]/actions";

export type ExplainerProps = {
  topicId: string;
  /** Which explainer to build — see getBeats(). 'box' and 'pyramid' differ. */
  topicSlug: string;
  /** Already in progress or finished, so the mount write would be a no-op. */
  alreadyStarted: boolean;
  /** Already finished, so paging to the last slide again need not rewrite it. */
  alreadyCompleted: boolean;
  /** Where the last slide hands off to, if this is not the final stage. */
  nextStage: { href: string; title: string } | null;
};

export default function Explainer({
  topicId,
  topicSlug,
  alreadyStarted,
  alreadyCompleted,
  nextStage,
}: ExplainerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ExplainerScene | null>(null);

  // This topic's slides, with its solid already pinned into each one.
  const beats = useMemo(() => getBeats(topicSlug), [topicSlug]);

  const [beat, setBeat] = useState(0);
  const [hint, setHint] = useState(true);
  const [user, setUser] = useState<UserState>(() => initialUserState(topicSlug));
  const completedRef = useRef(alreadyCompleted);

  /* ---- the 3D world: created once, then fed ---- */
  useEffect(() => {
    if (!stageRef.current || !labelsRef.current) return;
    const scene = createExplainerScene(stageRef.current, labelsRef.current);
    sceneRef.current = scene;
    const stage = stageRef.current;
    const drop = () => setHint(false);
    stage.addEventListener("pointerdown", drop);
    const t = setTimeout(drop, 5000);
    return () => {
      clearTimeout(t);
      stage.removeEventListener("pointerdown", drop);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  /* ---- push the current beat + user state into the scene ---- */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const b = beats[beat];
    const params: SceneParams = {
      dims: user.dims,
      solid: user.solid,
      unfold: user.unfold,
      glass: b.glass,
      fill: user.fill,
      groups: {
        ...BEAT_GROUPS,
        ...b.groups,
        // The two abstract beats draw neither solid.
        solidVisible: b.solids !== "none",
        // The containing box only appears while arguing the pyramid's third.
        third: b.control === "fill" && user.solid === "pyr",
        doubled: user.doubled && b.control === "double",
      },
      labels: {
        ...BEAT_LABELS,
        ...b.labels,
        areas: b.areasWhenFlat ? user.unfold > 0.45 : (b.labels?.areas ?? false),
      },
      faceKind: user.faceKind,
      pyrFaceKind: user.pyrFaceKind,
      tppTheta: user.tppTheta,
      soloH: user.soloH,
      parT: user.parT,
      criAng: user.criAng,
      showArc: b.showArc ?? true,
      showMarkBase: b.showMarkBase ?? true,
      showPrjArc: b.showPrjArc ?? true,
    };
    scene.update(params);
  }, [beat, user, beats]);

  /* ---- mark the stage started ---- */
  useEffect(() => {
    if (alreadyStarted) return;
    void markStageProgress({ topicId, stageType: "explainer", status: "in_progress" });
  }, [topicId, alreadyStarted]);

  const go = useCallback(
    (next: number) => {
      const i = Math.max(0, Math.min(beats.length - 1, next));
      setBeat(i);
      const patch = beats[i].onEnter;
      if (patch) setUser((u) => ({ ...u, ...patch }));

      // Finishing the last slide is what completes the stage. Guarded so
      // paging back and forth across the end doesn't rewrite it every time.
      if (i === beats.length - 1 && !completedRef.current) {
        completedRef.current = true;
        void markStageProgress({
          topicId,
          stageType: "explainer",
          status: "completed",
          details: { beat: i },
        });
      }
    },
    [topicId, beats],
  );

  // Kept wired, but unreachable: Controls renders the solid toggle only for a
  // beat whose mode is 'both', and getBeats() resolves that away per topic.
  const setSolid = useCallback(
    (solid: Solid) => {
      sceneRef.current?.stopSpin();
      setUser((u) => ({ ...u, ...beats[beat].onEnter, solid }));
    },
    [beat, beats],
  );

  const set = useCallback((patch: Partial<UserState>) => {
    sceneRef.current?.stopSpin();
    setUser((u) => {
      const next = { ...u, ...patch };
      // Shrinking the box can strand the fill slider past the new volume.
      if (patch.dims) next.fill = Math.min(next.fill, volume(patch.dims));
      return next;
    });
  }, []);

  const b = beats[beat];
  const text = beatText(b, user.solid);

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        ref={stageRef}
        className="explainer-stage relative min-h-0 flex-1 touch-none overflow-hidden"
      >
        <div ref={labelsRef} className="explainer-labels" />
        <p
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-3.5 left-1/2 -translate-x-1/2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-zinc-500 transition-opacity duration-500 ${
            hint ? "opacity-100" : "opacity-0"
          }`}
        >
          drag to rotate
        </p>
      </div>

      <div className="flex-none border-t border-zinc-200 bg-white/95 px-5 py-4 lg:flex lg:w-[38%] lg:max-w-[440px] lg:items-center lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-8 dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto w-full max-w-[640px]">
          <ol className="mb-3 flex list-none gap-1.5" aria-label="Slide progress">
            {beats.map((_, i) => (
              <li
                key={i}
                aria-current={i === beat ? "step" : undefined}
                className={`h-0.5 flex-1 rounded ${
                  i <= beat ? "bg-foreground" : "bg-zinc-200 dark:bg-zinc-800"
                }`}
              />
            ))}
          </ol>

          <h2 className="text-[clamp(19px,4.4vw,25px)] font-bold leading-tight tracking-[-0.01em]">
            {text.title}
          </h2>
          <p className="mt-1.5 min-h-[42px] text-[14.8px] text-zinc-600 dark:text-zinc-400">
            {text.body}
          </p>

          {text.know && (
            <details className="mt-2.5 border-t border-zinc-200 pt-2 dark:border-zinc-800">
              <summary className="know-summary flex cursor-pointer items-center gap-1.5 text-[12.5px] tracking-[0.06em] text-rail-current">
                {text.know.t}
              </summary>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{text.know.p}</p>
            </details>
          )}

          <div className="mt-3 min-h-[50px]">
            <Controls
              kind={b.control}
              solids={b.solids}
              user={user}
              set={set}
              setSolid={setSolid}
            />
          </div>

          <div className="mt-3.5 flex gap-2.5">
            <button
              type="button"
              onClick={() => go(beat - 1)}
              disabled={beat === 0}
              className="rounded border border-zinc-200 px-4 py-3 text-[15px] disabled:opacity-25 dark:border-zinc-800"
            >
              Back
            </button>
            {beat === beats.length - 1 && nextStage ? (
              // The lesson is over, so the primary action stops being "next
              // slide" and becomes the hand-off to the next stage.
              <Link
                href={nextStage.href}
                className="flex-1 rounded bg-rail-current px-4 py-3 text-center text-[15px] font-semibold text-white"
              >
                Next: {nextStage.title} →
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => go(beat + 1)}
                disabled={beat === beats.length - 1}
                className="flex-1 rounded bg-rail-current px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-25"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
