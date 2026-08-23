import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { stageOwner } from "@/lib/stages";
import { cn } from "@/lib/utils";
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
  current: "bg-brand ring-4 ring-brand/20 scale-110",
  done: "bg-correct",
  todo: "bg-line-strong",
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
 * The three-node progress indicator above every stage.
 *
 * It is also the only chrome the stage routes have — they are full-viewport
 * and deliberately skip AppHeader — so it carries the theme toggle too.
 *
 * Progression is not enforced: every node is a live link no matter what the
 * user has finished, so this reports state and never gates on it. Its height
 * is --rail-h, which the stage pages size their canvas against.
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
      className={cn(
        "flex h-(--rail-h) flex-none items-center gap-4 px-3 sm:px-4",
        "border-b border-line bg-bg/85 backdrop-blur-md",
        "font-mono text-eyebrow uppercase",
      )}
    >
      {backHref && (
        <Link
          href={backHref}
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap rounded-md text-muted",
            "transition-colors duration-(--dur-press) ease-out hover:text-fg",
          )}
        >
          <span aria-hidden="true">←</span>
          <span className="max-sm:sr-only">{backLabel ?? "Back"}</span>
        </Link>
      )}

      <ol className="flex max-w-[320px] flex-1 items-center">
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
              className={cn(
                "flex items-center",
                i === 0 ? "flex-none" : "flex-1",
              )}
            >
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px flex-1 transition-colors duration-(--dur-enter) ease-out",
                    prevDone ? "bg-correct" : "bg-line-strong",
                  )}
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
                  className={cn(
                    "size-[7px] rounded-full",
                    "transition-all duration-(--dur-enter) ease-[cubic-bezier(0.2,0.9,0.3,1.4)]",
                    "group-hover:scale-125 motion-reduce:transition-none",
                    DOT_CLASS[state],
                  )}
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
        <span className="hidden whitespace-nowrap text-brand-text sm:inline">
          {current.title}
        </span>
      )}

      <ThemeToggle className="ml-auto" />
    </nav>
  );
}
