import { notFound } from "next/navigation";
import ProgressRail from "@/components/progress-rail";
import Explainer from "@/components/explainer/explainer";
import { getStageView, nextStageOf } from "@/lib/topics";
import { stageHref } from "@/components/progress-rail";

export async function generateMetadata(
  props: PageProps<"/[subject]/[topicSlug]/explainer">,
) {
  const { subject, topicSlug } = await props.params;
  const view = await getStageView(subject, topicSlug, "explainer");
  return { title: view ? `${view.stage.title} — ${view.topic.title}` : "Not found" };
}

export default async function ExplainerPage(
  props: PageProps<"/[subject]/[topicSlug]/explainer">,
) {
  const { subject, topicSlug } = await props.params;
  const view = await getStageView(subject, topicSlug, "explainer");
  if (!view) notFound();

  const progress = view.progress.byStage.explainer;
  const next = nextStageOf(view.stages, "explainer");

  return (
    // 100dvh rather than flex-1: body is min-h-full, so a flex child has no
    // definite height to resolve against and the WebGL canvas collapses to 0.
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <ProgressRail
        subject={subject}
        topicSlug={topicSlug}
        stages={view.stages}
        progress={view.progress.byStage}
        currentStage="explainer"
        backHref={`/${subject}`}
        backLabel={view.subject.title}
      />
      <Explainer
        topicId={view.topic.id}
        topicSlug={topicSlug}
        alreadyStarted={progress.status !== "not_started"}
        alreadyCompleted={progress.status === "completed"}
        nextStage={
          next
            ? { href: stageHref(subject, topicSlug, next.stageType), title: next.title }
            : null
        }
      />
    </div>
  );
}
