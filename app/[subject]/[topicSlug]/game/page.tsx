import { notFound } from "next/navigation";
import ProgressRail from "@/components/progress-rail";
import Game from "@/components/game/game";
import { getStageView } from "@/lib/topics";

export async function generateMetadata(props: PageProps<"/[subject]/[topicSlug]/game">) {
  const { subject, topicSlug } = await props.params;
  const view = await getStageView(subject, topicSlug, "game");
  return { title: view ? `${view.stage.title} — ${view.topic.title}` : "Not found" };
}

export default async function GamePage(props: PageProps<"/[subject]/[topicSlug]/game">) {
  const { subject, topicSlug } = await props.params;
  const view = await getStageView(subject, topicSlug, "game");
  if (!view) notFound();

  const progress = view.progress.byStage.game;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <ProgressRail
        subject={subject}
        topicSlug={topicSlug}
        stages={view.stages}
        progress={view.progress.byStage}
        currentStage="game"
        backHref={`/${subject}`}
        backLabel={view.subject.title}
      />
      <Game
        topicId={view.topic.id}
        alreadyStarted={progress.status !== "not_started"}
        initialUnlocked={progress.details.unlocked}
        initialBest={progress.details.best}
        subjectHref={`/${subject}`}
      />
    </div>
  );
}
