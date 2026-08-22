import Link from "next/link";
import { HomeLink } from "@/components/logo";
import { TopicList } from "@/components/topic-list";
import { getLearnTree } from "@/lib/topics";

export const metadata = { title: "Subjects — LeMiu" };

/**
 * Subject selection. Open to everyone — there are no auth guards on any
 * content page, and progress is simply not recorded when signed out.
 */
export default async function LearnPage() {
  const areas = await getLearnTree();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-12 px-6 py-12">
      <header className="flex flex-col gap-2">
        <HomeLink />
        <h1 className="text-3xl font-semibold">Pick a subject</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Everything is free to browse. Sign in only if you want your progress kept.
        </p>
      </header>

      {areas.map((area) => {
        // Algebra is entirely unbuilt, so its topics read "Coming Soon";
        // Geometry's unbuilt ones keep the existing "In development" wording.
        const pendingLabel = area.status === "available" ? "In development" : "Coming Soon";

        return (
          <section key={area.slug} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-2xl font-semibold">{area.title}</h2>
              {area.status !== "available" && (
                <span className="rounded-full border border-zinc-300 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 dark:border-zinc-700">
                  Coming Soon
                </span>
              )}
            </div>
            {area.blurb && (
              <p className="text-zinc-600 dark:text-zinc-400">{area.blurb}</p>
            )}

            {/* An area either holds topics itself, or groups subjects that do. */}
            {area.children.length > 0 ? (
              <div className="flex flex-col gap-6">
                {area.children.map((child) => (
                  <div key={child.slug} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        {child.status === "available" ? (
                          <Link href={`/${child.slug}`} className="hover:text-foreground">
                            {child.title}
                          </Link>
                        ) : (
                          child.title
                        )}
                      </h3>
                    </div>
                    <TopicList topics={child.topics} pendingLabel="In development" />
                  </div>
                ))}
              </div>
            ) : (
              <TopicList topics={area.topics} pendingLabel={pendingLabel} />
            )}
          </section>
        );
      })}
    </main>
  );
}
