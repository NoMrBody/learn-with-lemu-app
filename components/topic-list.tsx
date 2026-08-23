import Link from "next/link";
import { stageHref } from "@/components/progress-rail";
import { cn } from "@/lib/utils";
import type { Topic } from "@/lib/topics";

/**
 * The topic cards, shared by /learn and the per-subject page so both stay in
 * step. An unbuilt topic is deliberately rendered as a non-link: visible so
 * the roadmap is legible, inert so it cannot be clicked.
 */

export function TopicCard({ topic, pendingLabel }: { topic: Topic; pendingLabel: string }) {
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
          <p className="mt-0.5 text-body-sm text-muted">
            Explainer, problems, and a puzzle.
          </p>
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
  topics, pendingLabel = "In development",
}: {
  topics: readonly Topic[];
  pendingLabel?: string;
}) {
  if (topics.length === 0) {
    return <p className="text-body-sm text-muted">No topics here yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {topics.map((t) => (
        <TopicCard key={t.id} topic={t} pendingLabel={pendingLabel} />
      ))}
    </ul>
  );
}
