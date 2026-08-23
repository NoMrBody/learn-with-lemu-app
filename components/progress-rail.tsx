import Link from "next/link";
import { stageOwner } from "@/lib/stages";
import type { ProgressByStage, StageType, TopicStage } from "@/lib/topics";

/**
 * Canonical URL for one stage of one topic.
 *
 * A stage a topic borrows resolves to the owner's route, not its own: the
 * pyramid's puzzle node links into /stereometry/box/game. That keeps one URL,
 * and so one progress row, for the shared stage.
 */
export function stageHref(
  subject: string,
  topicSlug: string,
  stageType: StageType,
): string {
  return `/${subject}/${stageOwner(subject, topicSlug, stageType)}/${stageType}`;
}

type NodeState = "current" | "done" | "todo";

/**
 * A completed stage you are currently sitting on still reads as "current" —
 * where you are outranks what you have finished, same as the legacy rail.
 */
function nodeState(
  stage: TopicStage,
  currentStage: StageType,
  progress: ProgressByStage,
): NodeState {
  if (stage.stageType === currentStage) return "current";
  return progress[stage.stageType].status === "completed" ? "done" : "todo";
}

const DOT_CLASS: Record<NodeState, string> = {
  // The ring is what makes "you are here" readable at a 7px dot size.
  current: "bg-rail-current ring-4 ring-rail-current/15",
  done: "bg-rail-done",
  todo: "bg-rail-todo",
};

const STATE_LABEL: Record<NodeState, string> = {
  current: "current stage",
  done: "completed",
  todo: "not started",
};

export type ProgressRailProps = {
  subject: string;
  topicSlug: string;
  /** From getTopicStages() — re-sorted here so the rail never depends on query order. */
  stages: TopicStage[];
  /** From getUserProgress().byStage. */
  progress: ProgressByStage;
  currentStage: StageType;
  backHref?: string;
  backLabel?: string;
};

/**
 * The three-node progress indicator that sits above every stage.
 *
 * Progression is not enforced: every node is a live link no matter what the
 * user has finished, so this reports state and never gates on it.
 */
export default function ProgressRail({
  subject,
  topicSlug,
  stages,
  progress,
  currentStage,
  backHref,
  backLabel,
}: ProgressRailProps) {
  const ordered = [...stages].sort((a, b) => a.orderIndex - b.orderIndex);
  const current = ordered.find((s) => s.stageType === currentStage);

  return (
    <nav
      aria-label="Topic progress"
      className="flex flex-none items-center gap-3.5 border-b border-rail-line px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em]"
    >
      {backHref && (
        <Link
          href={backHref}
          className="whitespace-nowrap text-zinc-500 transition-colors hover:text-foreground"
        >
          ← {backLabel ?? "Back"}
        </Link>
      )}

      <ol className="flex max-w-[340px] flex-1 items-center">
        {ordered.map((stage, i) => {
          const state = nodeState(stage, currentStage, progress);
          // A segment is lit by the stage behind it, so the trail fills in
          // only as far as the user has actually got.
          const prevDone =
            i > 0 && progress[ordered[i - 1].stageType].status === "completed";

          return (
            // Each node owns the segment that leads into it. `display:contents`
            // would lay this out identically with less markup, but it drops
            // <li> from the accessibility tree in several browsers.
            <li
              key={stage.id}
              className={i === 0 ? "flex flex-none items-center" : "flex flex-1 items-center"}
            >
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`h-px flex-1 ${prevDone ? "bg-rail-done" : "bg-rail-line"}`}
                />
              )}
              <Link
                href={stageHref(subject, topicSlug, stage.stageType)}
                aria-current={state === "current" ? "page" : undefined}
                title={stage.title}
                // -my-2 keeps the 24px tap target from growing the bar. The
                // legacy rail made the 7px dot itself the hit area, which is
                // well under the 24px minimum on touch.
                className="group -my-2 grid size-6 flex-none place-items-center rounded-full"
              >
                <span
                  className={`size-[7px] rounded-full transition-all duration-300 group-hover:scale-125 ${DOT_CLASS[state]}`}
                />
                <span className="sr-only">
                  {stage.title} — {STATE_LABEL[state]}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {current && (
        <span className="hidden whitespace-nowrap text-rail-current sm:inline">
          {current.title}
        </span>
      )}
    </nav>
  );
}
