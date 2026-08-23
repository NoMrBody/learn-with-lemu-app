import Link from "next/link";
import { notFound } from "next/navigation";
import ProgressRail from "@/components/progress-rail";
import Problems from "@/components/problems/problems";
import { getProblems } from "@/lib/problems/data";
import { getStageView, nextStageOf } from "@/lib/topics";
import { stageHref } from "@/components/progress-rail";

export async function generateMetadata(
  props: PageProps<"/[subject]/[topicSlug]/problem">,
) {
  const { subject, topicSlug } = await props.params;
  const view = await getStageView(subject, topicSlug, "problem");
  return { title: view ? `${view.stage.title} — ${view.topic.title}` : "Not found" };
}

export default async function ProblemPage(
  props: PageProps<"/[subject]/[topicSlug]/problem">,
) {
  const { subject, topicSlug } = await props.params;
  const view = await getStageView(subject, topicSlug, "problem");
  if (!view) notFound();

  const progress = view.progress.byStage.problem;
  const next = nextStageOf(view.stages, "problem");

  // A topic can be navigable before its problems are written — the pyramid is,
  // while its set fills up. Mounting <Problems> on an empty set would index
  // past the end of the array on its first render, so the stage says so
  // instead, with the rail intact so the reader can move on.
  const hasProblems = getProblems(topicSlug).length > 0;

  if (!hasProblems) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <ProgressRail
          subject={subject}
          topicSlug={topicSlug}
          stages={view.stages}
          progress={view.progress.byStage}
          currentStage="problem"
          backHref={`/${subject}`}
          backLabel={view.subject.title}
        />
        <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-center px-5 py-16">
          <h1 className="text-[clamp(21px,5vw,28px)] font-bold tracking-[-0.01em]">
            Not written yet.
          </h1>
          <p className="mt-2 text-[15px] text-zinc-600 dark:text-zinc-400">
            {view.topic.title} has no worked problems on it so far. The rest of the
            topic is finished — this is the one part still being written.
          </p>
          {next && (
            <Link
              href={stageHref(subject, topicSlug, next.stageType)}
              className="mt-6 self-start rounded bg-rail-current px-4 py-3 text-[15px] font-semibold text-white"
            >
              Skip to {next.title} →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <ProgressRail
        subject={subject}
        topicSlug={topicSlug}
        stages={view.stages}
        progress={view.progress.byStage}
        currentStage="problem"
        backHref={`/${subject}`}
        backLabel={view.subject.title}
      />
      <Problems
        topicId={view.topic.id}
        topicSlug={topicSlug}
        alreadyStarted={progress.status !== "not_started"}
        initialSolved={progress.details.solved}
        nextStage={
          next
            ? { href: stageHref(subject, topicSlug, next.stageType), title: next.title }
            : null
        }
      />
    </div>
  );
}
