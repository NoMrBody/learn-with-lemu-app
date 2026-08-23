import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * Public landing page. No auth required — browsing is open, so the CTAs are
 * an invitation rather than a gate.
 */

// The three stages are a real sequence, which is what earns the numbering.
const STAGES = [
  {
    n: "01",
    title: "Explainer",
    body: "A solid you can turn in your hands. Drag it flat, fill it with cubes, slice it — the formula arrives after you have already seen why.",
  },
  {
    n: "02",
    title: "Problems",
    body: "Worked one step at a time. Each step asks before it tells, and hands you the one tool it needed.",
  },
  {
    n: "03",
    title: "Puzzle",
    body: "No walkthrough. Tap three points, pick the rule that fits the triangle, and find the length in as few moves as you can.",
  },
] as const;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <AppHeader />

      <main className="flex flex-1 flex-col">
        {/* ---- hero ---- */}
        <section className="grid-paper border-b border-line">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-20 sm:px-6 sm:py-28">
            <div className="flex items-center gap-2.5 font-mono text-eyebrow uppercase text-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
              Stereometry, and everything after it
            </div>

            <h1 className="max-w-[15ch] text-display">
              Maths you can{" "}
              <span className="text-brand-text">look at</span>.
            </h1>

            <p className="max-w-[54ch] text-body-lg text-muted">
              Every topic comes in three parts: an interactive 3D explainer, a set of
              worked problems, and a puzzle that makes you find the move yourself.
              Nothing here needs a calculator.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/learn">Browse subjects</Link>
              </Button>
              {user ? (
                <Button asChild variant="outline" size="lg">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="lg">
                  <Link href="/signup">Save my progress</Link>
                </Button>
              )}
            </div>

            <p className="text-body-sm text-muted">
              {user
                ? `Signed in as ${user.email}. Your progress is saved as you go.`
                : "Browse and play everything without an account — signing in is only so your progress is kept."}
            </p>
          </div>
        </section>

        {/* ---- the three stages ---- */}
        <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-6 sm:py-20">
          <h2 className="font-mono text-eyebrow uppercase text-muted">
            How a topic goes
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {STAGES.map((s) => (
              <li
                key={s.n}
                className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5"
              >
                <span className="font-mono text-eyebrow text-brand-text">{s.n}</span>
                <h3 className="text-h3">{s.title}</h3>
                <p className="text-body-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---- the thesis, in the ledger's own voice ---- */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-16 sm:flex-row sm:items-center sm:px-6 sm:py-20">
            <div className="flex flex-1 flex-col gap-4">
              <h2 className="max-w-[18ch] text-h1">
                Every length you need is already there.
              </h2>
              <p className="max-w-[46ch] text-body-lg text-muted">
                This is not a test of arithmetic. What it asks is whether you can look at
                a solid and see which flat triangle is hiding inside it — and which rule
                that triangle is waiting for.
              </p>
            </div>

            {/* A still of the Ledger: what the app hands you as you work. */}
            <div className="w-full sm:max-w-[280px]">
              <div className="flex items-center gap-2 font-mono text-eyebrow uppercase text-muted">
                What you know
                <span aria-hidden="true" className="h-px flex-1 bg-line" />
                <span className="tabular-nums text-faint">3</span>
              </div>
              <ol className="mt-2.5 flex flex-col gap-1">
                {[
                  ["AB", "6", "text-fg"],
                  ["AC", "7.21", "text-known"],
                  ["CC₁", "3", "text-known"],
                ].map(([k, v, tone]) => (
                  <li
                    key={k}
                    className="flex items-baseline gap-3 rounded-md border border-line bg-bg px-2.5 py-1.5 font-mono text-body-sm tabular-nums"
                  >
                    <span className="text-muted">{k}</span>
                    <span aria-hidden="true" className="text-faint">=</span>
                    <span className={`ml-auto font-semibold ${tone}`}>{v}</span>
                  </li>
                ))}
                <li className="flex items-baseline gap-3 rounded-md border border-dashed border-brand/55 bg-brand-soft/40 px-2.5 py-1.5 font-mono text-body-sm tabular-nums">
                  <span className="text-brand-text">AC₁</span>
                  <span aria-hidden="true" className="text-faint">=</span>
                  <span className="ml-auto font-semibold text-brand-text">?</span>
                </li>
              </ol>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-5 py-6 font-mono text-eyebrow uppercase text-faint sm:px-6">
          <span>LeMiu</span>
          <span aria-hidden="true" className="h-px flex-1 bg-line" />
          <Link
            href="/learn"
            className="rounded-md transition-colors duration-(--dur-press) ease-out hover:text-fg"
          >
            Subjects
          </Link>
        </div>
      </footer>
    </>
  );
}
