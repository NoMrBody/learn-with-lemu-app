import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { TopicList } from "@/components/topic-list";
import { getLearnTree, listStagesFor } from "@/lib/topics";

export const metadata = { title: "Subjects" };

/**
 * Subject selection. Open to everyone — there are no auth guards on any
 * content page, and progress is simply not recorded when signed out.
 */
export default async function LearnPage() {
  const areas = await getLearnTree();
  // One query for every card in the tree, so each says what it actually holds.
  const stagesByTopic = await listStagesFor(
    areas
      .flatMap((a) => [...a.topics, ...a.children.flatMap((c) => c.topics)])
      .map((t) => t.id),
  );

  return (
    <>
      <AppHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-14 px-5 py-12 sm:px-6 sm:py-16">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-eyebrow uppercase text-muted">Everything built so far</p>
          <h1 className="text-h1">Pick a subject</h1>
          <p className="max-w-[52ch] text-body-lg text-muted">
            Free to browse. Sign in only if you want your progress kept.
          </p>
        </header>

        {areas.map((area) => {
          // Algebra is entirely unbuilt, so its topics read "Coming Soon";
          // Geometry's unbuilt ones keep the existing "In development" wording.
          const pendingLabel = area.status === "available" ? "In development" : "Coming Soon";

          return (
            <section key={area.slug} className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
                <h2 className="text-h2">{area.title}</h2>
                {area.status !== "available" && (
                  <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-eyebrow uppercase text-faint">
                    Coming Soon
                  </span>
                )}
              </div>
              {area.blurb && (
                <p className="max-w-[58ch] text-body text-muted">{area.blurb}</p>
              )}

              {/* An area either holds topics itself, or groups subjects that do. */}
              {area.children.length > 0 ? (
                <div className="flex flex-col gap-8">
                  {area.children.map((child) => (
                    <div key={child.slug} className="flex flex-col gap-3">
                      <h3 className="font-mono text-eyebrow uppercase text-muted">
                        {child.status === "available" ? (
                          <Link
                            href={`/${child.slug}`}
                            className="rounded-md transition-colors duration-(--dur-press) ease-out hover:text-brand-text"
                          >
                            {child.title}
                          </Link>
                        ) : (
                          child.title
                        )}
                      </h3>
                      <TopicList
                        topics={child.topics}
                        stagesByTopic={stagesByTopic}
                        pendingLabel="In development"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <TopicList
                  topics={area.topics}
                  stagesByTopic={stagesByTopic}
                  pendingLabel={pendingLabel}
                />
              )}
            </section>
          );
        })}
      </main>
    </>
  );
}
