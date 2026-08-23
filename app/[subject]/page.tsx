import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { TopicList } from "@/components/topic-list";
import { getSubject, listChildSubjects, listTopics } from "@/lib/topics";

export async function generateMetadata(props: PageProps<"/[subject]">) {
  const { subject: slug } = await props.params;
  const subject = await getSubject(slug);
  return { title: subject ? subject.title : "Not found" };
}

export default async function SubjectPage(props: PageProps<"/[subject]">) {
  const { subject: slug } = await props.params;
  const subject = await getSubject(slug);
  if (!subject) notFound();

  // A grouping subject (Geometry) holds no topics of its own — it lists the
  // subjects nested under it instead.
  const [topics, children] = await Promise.all([
    listTopics(slug),
    listChildSubjects(slug),
  ]);
  // Resolved up front rather than with an async callback inside map, so the
  // JSX children are plain elements rather than an array of promises.
  const childTopics = await Promise.all(
    children.map(async (c) => ({ child: c, topics: await listTopics(c.slug) })),
  );

  return (
    <>
      <AppHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-5 py-12 sm:px-6 sm:py-16">
        <header className="flex flex-col gap-3">
          <Link
            href="/learn"
            className="inline-flex w-fit items-center gap-1.5 rounded-md font-mono text-eyebrow uppercase text-muted transition-colors duration-(--dur-press) ease-out hover:text-fg"
          >
            <span aria-hidden="true">←</span> Subjects
          </Link>
          <h1 className="text-h1">{subject.title}</h1>
          {subject.blurb && (
            <p className="max-w-[54ch] text-body-lg text-muted">{subject.blurb}</p>
          )}
          {subject.status === "in_development" && (
            <p className="mt-1 flex items-center gap-2 rounded-lg border border-caution/40 bg-caution-soft px-3 py-2 text-body-sm text-caution">
              <span aria-hidden="true">◆</span>
              This subject is still being built — nothing here is playable yet.
            </p>
          )}
        </header>

        {children.length > 0 ? (
          <div className="flex flex-col gap-10">
            {childTopics.map(({ child, topics: kids }) => (
              <section key={child.slug} className="flex flex-col gap-4">
                <h2 className="border-b border-line pb-3 text-h2">
                  <Link
                    href={`/${child.slug}`}
                    className="rounded-md transition-colors duration-(--dur-press) ease-out hover:text-brand-text"
                  >
                    {child.title}
                  </Link>
                </h2>
                <TopicList topics={kids} />
              </section>
            ))}
          </div>
        ) : (
          <TopicList topics={topics} />
        )}
      </main>
    </>
  );
}
