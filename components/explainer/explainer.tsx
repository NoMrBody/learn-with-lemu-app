"use client";

import "katex/dist/katex.min.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Controls from "./controls";
import { Button } from "@/components/ui/button";
import {
  BEAT_GROUPS, BEAT_LABELS, beatText, getBeats, initialUserState, type UserState,
} from "@/lib/explainer/beats";
import {
  createExplainerScene, volume, type ExplainerScene, type SceneParams,
  type Solid,
} from "@/lib/explainer/scene";
import {
  PRISM_ANGS, PRISM_SECS, PRISM_SIZES, PRISM_TRIS, clampIdx, type PrismId,
} from "@/lib/explainer/prisms";
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
      fig: user.fig,
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
        // The cuboid folds doubling into its volume slide; the pyramid still
        // gives it one of its own.
        doubled: user.doubled && (b.control === "double" || b.control === "vol"),
        angle: b.control === "ang",
      },
      labels: {
        ...BEAT_LABELS,
        ...b.labels,
        areas: b.areasWhenFlat ? user.unfold > 0.45 : (b.labels?.areas ?? false),
      },
      faceKind: user.faceKind,
      pyrFaceKind: user.pyrFaceKind,
      pyrTri: user.pyrTri,
      pyrAng: user.pyrAng,
      tppTheta: user.tppTheta,
      soloH: user.soloH,
      parT: user.parT,
      criAng: user.criAng,
      showArc: b.showArc ?? true,
      showMarkBase: b.showMarkBase ?? true,
      showPrjArc: b.showPrjArc ?? true,
      // A catalogue index only means anything on its own beat; elsewhere it is
      // null so the scene falls back to the named-face highlight.
      triIdx: b.control === "tris" ? user.triIdx : null,
      secIdx: b.control === "secs" ? user.secIdx : null,
      angIdx: b.control === "ang" ? user.angIdx : null,
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

  /**
   * A new prism brings its own proportions and its own catalogues, so the
   * sizes are reset and every chip index is pulled back inside the new lists —
   * they are different lengths, and an index past the end would blank a slide.
   */
  const setFig = useCallback(
    (fig: PrismId) => {
      sceneRef.current?.stopSpin();
      setUser((u) => ({
        ...u,
        fig,
        dims: PRISM_SIZES[fig],
        fill: 0,
        unfold: 0,
        doubled: false,
        triIdx: clampIdx(u.triIdx, PRISM_TRIS[fig].length),
        secIdx: clampIdx(u.secIdx, PRISM_SECS[fig].length),
        angIdx: clampIdx(u.angIdx, PRISM_ANGS[fig].length),
      }));
    },
    [],
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
  const text = beatText(b, user.solid, user.fig);
  const last = beat === beats.length - 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div
        ref={stageRef}
        className="explainer-stage relative min-h-0 flex-1 touch-none overflow-hidden"
      >
        <div ref={labelsRef} className="explainer-labels" />
        <p
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-fig-rule bg-fig-paper/70 px-3 py-1 font-mono text-eyebrow uppercase text-fig-dim backdrop-blur-sm transition-opacity duration-500 ease-out ${
            hint ? "opacity-100" : "opacity-0"
          }`}
        >
          drag to rotate
        </p>
      </div>

      <div className="flex-none border-t border-line bg-surface px-5 py-5 lg:flex lg:w-[38%] lg:max-w-[440px] lg:items-center lg:overflow-y-auto lg:border-l lg:border-t-0 lg:p-8">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
          {/* Slide progress: a segment per beat, plus the count in mono so
              the reader knows how much is left without counting dashes. */}
          <div className="flex items-center gap-3">
            <ol className="flex flex-1 list-none gap-1" aria-label="Slide progress">
              {beats.map((_, i) => (
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
              {String(beat + 1).padStart(2, "0")}/{String(beats.length).padStart(2, "0")}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-h2">{text.title}</h2>
            <p className="min-h-[42px] text-body text-muted">{text.body}</p>
          </div>

          {text.know && (
            <details className="border-t border-line pt-3">
              <summary className="know-summary flex cursor-pointer items-center gap-1.5 rounded-md text-body-sm font-medium text-brand-text">
                {text.know.t}
              </summary>
              <p className="mt-2 text-body-sm text-muted">{text.know.p}</p>
            </details>
          )}

          <div className="min-h-[50px]">
            <Controls
              kind={b.control}
              solids={b.solids}
              user={user}
              set={set}
              setSolid={setSolid}
              setFig={setFig}
            />
          </div>

          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => go(beat - 1)}
              disabled={beat === 0}
            >
              Back
            </Button>
            {last && nextStage ? (
              // The lesson is over, so the primary action stops being "next
              // slide" and becomes the hand-off to the next stage.
              <Button asChild size="lg" className="flex-1">
                <Link href={nextStage.href}>Next: {nextStage.title} →</Link>
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                className="flex-1"
                onClick={() => go(beat + 1)}
                disabled={last}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
