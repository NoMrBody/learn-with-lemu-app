import { notFound } from "next/navigation";
import ProgressRail from "@/components/progress-rail";
import Explainer from "@/components/explainer/explainer";
import AxiomsExplainer from "@/components/explainer/axioms-explainer";
import { getStageView, nextStageOf } from "@/lib/topics";
import { stageHref } from "@/components/progress-rail";

/**
 * Topics whose explainer is its own component rather than a selection from
 * the shared BEATS array. Axioms is about points, lines and planes, so it has
 * neither a solid on screen nor any of the sliders the box and the pyramid
 * are built around.
 */
const AXIOMS_SLUG = "axioms";

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
      {topicSlug === AXIOMS_SLUG ? (
        <AxiomsExplainer
          topicId={view.topic.id}
          alreadyStarted={progress.status !== "not_started"}
          alreadyCompleted={progress.status === "completed"}
          nextStage={
            next
              ? { href: stageHref(subject, topicSlug, next.stageType), title: next.title }
              : null
          }
          // Axioms is a single-stage topic, so its last slide has no next
          // stage to hand off to and returns to the topic list instead.
          home={{ href: `/${subject}`, title: view.subject.title }}
        />
      ) : (
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
      )}
    </div>
  );
}
