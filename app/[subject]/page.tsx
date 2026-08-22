import Link from "next/link";
import { notFound } from "next/navigation";
import { TopicList } from "@/components/topic-list";
import { getSubject, listChildSubjects, listTopics } from "@/lib/topics";

export async function generateMetadata(props: PageProps<"/[subject]">) {
  const { subject: slug } = await props.params;
  const subject = await getSubject(slug);
  return { title: subject ? `${subject.title} — LeMiu` : "Not found" };
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
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/learn"
          className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 hover:text-foreground"
        >
          ← Subjects
        </Link>
        <h1 className="text-3xl font-semibold">{subject.title}</h1>
        {subject.blurb && (
          <p className="text-zinc-600 dark:text-zinc-400">{subject.blurb}</p>
        )}
        {subject.status === "in_development" && (
          <p className="mt-1 text-sm text-zinc-500">
            This subject is still being built — nothing here is playable yet.
          </p>
        )}
      </header>

      {children.length > 0 ? (
        <div className="flex flex-col gap-8">
          {childTopics.map(({ child, topics: kids }) => (
            <section key={child.slug} className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">
                <Link href={`/${child.slug}`} className="hover:text-rail-current">
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
  );
}
