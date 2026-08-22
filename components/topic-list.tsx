import Link from "next/link";
import { stageHref } from "@/components/progress-rail";
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
      <li className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-zinc-300 px-5 py-4 opacity-60 dark:border-zinc-700">
        <div>
          <h3 className="font-medium text-zinc-500 dark:text-zinc-400">{topic.title}</h3>
          <p className="mt-0.5 text-sm text-zinc-400 dark:text-zinc-500">Not built yet.</p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-zinc-300 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {pendingLabel}
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={stageHref(topic.subject, topic.slug, "explainer")}
        className="group flex items-center justify-between gap-4 rounded-lg border border-zinc-200 px-5 py-4 transition-colors hover:border-rail-current hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
      >
        <div>
          <h3 className="font-medium">{topic.title}</h3>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Explainer, problems, and a puzzle.
          </p>
        </div>
        <span
          aria-hidden="true"
          className="text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-rail-current"
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
    return <p className="text-zinc-500">No topics here yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {topics.map((t) => (
        <TopicCard key={t.id} topic={t} pendingLabel={pendingLabel} />
      ))}
    </ul>
  );
}
