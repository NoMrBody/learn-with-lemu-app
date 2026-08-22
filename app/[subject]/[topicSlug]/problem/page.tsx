import { notFound } from "next/navigation";
import ProgressRail from "@/components/progress-rail";
import Problems from "@/components/problems/problems";
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
