import Link from "next/link";
import { stageHref } from "@/components/progress-rail";
import { cn } from "@/lib/utils";
import type { StageType, Topic, TopicStage } from "@/lib/topics";

/**
 * The topic cards, shared by /learn and the per-subject page so both stay in
 * step. An unbuilt topic is deliberately rendered as a non-link: visible so
 * the roadmap is legible, inert so it cannot be clicked.
 */

/** What each stage is called in the one-line summary under a topic's title. */
const STAGE_NOUN: Record<StageType, string> = {
  explainer: "explainer",
  problem: "problems",
  game: "a puzzle",
};

/**
 * The summary line, built from the topic's real stage rows.
 *
 * This was the fixed string "Explainer, problems, and a puzzle." on every
 * card, which was true while every built topic had all three stages and
 * stopped being true the moment one did not: axioms is a walkthrough with no
 * problem set and no puzzle, and a card promising both sells content that
 * does not exist. Three stages still read exactly as before.
 *
 * Null for a topic with no stages at all, where the honest thing is to say
 * nothing rather than invent a description.
 */
function summarise(stages: readonly TopicStage[]): string | null {
  const nouns = [...stages]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((s) => STAGE_NOUN[s.stageType]);
  if (nouns.length === 0) return null;

  const listed =
    nouns.length === 1
      ? nouns[0]
      : nouns.length === 2
        ? `${nouns[0]} and ${nouns[1]}`
        : `${nouns.slice(0, -1).join(", ")}, and ${nouns[nouns.length - 1]}`;

  return `${listed[0].toUpperCase()}${listed.slice(1)}.`;
}

export function TopicCard({
  topic, stages, pendingLabel,
}: {
  topic: Topic;
  /** This topic's stage rows, from listStagesFor(). */
  stages: readonly TopicStage[];
  pendingLabel: string;
}) {
  if (topic.status !== "available") {
    // No aria-disabled: it is not valid on a listitem, and the badge below is
    // real text, so the state is announced anyway.
    return (
      <li className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-line-strong px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-body font-medium text-muted">{topic.title}</h3>
          <p className="mt-0.5 text-body-sm text-faint">Not built yet.</p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-line-strong px-2.5 py-1 font-mono text-eyebrow uppercase text-faint">
          {pendingLabel}
        </span>
      </li>
    );
  }

  const summary = summarise(stages);

  return (
    <li>
      <Link
        href={stageHref(topic.subject, topic.slug, "explainer")}
        className={cn(
          "group flex items-center justify-between gap-4 rounded-xl border border-line",
          "bg-surface px-5 py-4",
          "transition-[background-color,border-color,transform] duration-(--dur-state) ease-out",
          "hover:border-brand/60 hover:bg-raised",
        )}
      >
        <div className="min-w-0">
          <h3 className="text-body font-semibold">{topic.title}</h3>
          {summary && <p className="mt-0.5 text-body-sm text-muted">{summary}</p>}
        </div>
        <span
          aria-hidden="true"
          className={cn(
            "font-mono text-faint",
            "transition-[transform,color] duration-(--dur-state) ease-out",
            "group-hover:translate-x-0.5 group-hover:text-brand-text",
            "motion-reduce:group-hover:translate-x-0",
          )}
        >
          →
        </span>
      </Link>
    </li>
  );
}

export function TopicList({
  topics, stagesByTopic, pendingLabel = "In development",
}: {
  topics: readonly Topic[];
  /**
   * Every listed topic's stages, keyed by topic id. Required rather than
   * optional: a default would put the old fixed wording back on any caller
   * that forgot to pass it, which is the bug this replaced.
   */
  stagesByTopic: ReadonlyMap<string, TopicStage[]>;
  pendingLabel?: string;
}) {
  if (topics.length === 0) {
    return <p className="text-body-sm text-muted">No topics here yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {topics.map((t) => (
        <TopicCard
          key={t.id}
          topic={t}
          stages={stagesByTopic.get(t.id) ?? []}
          pendingLabel={pendingLabel}
        />
      ))}
    </ul>
  );
}
