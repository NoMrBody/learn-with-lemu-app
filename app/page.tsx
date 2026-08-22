import Link from "next/link";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";

/**
 * Public landing page. No auth required — browsing is open, so the CTAs are
 * an invitation rather than a gate.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-20">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <Logo className="h-8 w-auto" sizes="36px" priority />
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-zinc-500">
            LeMiu
          </p>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          Maths you can look at.
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Every topic comes in three parts: an interactive 3D explainer, a set of worked
          problems, and a puzzle that makes you find the move yourself. Nothing here needs
          a calculator.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/learn"
          className="rounded-lg bg-foreground px-5 py-3 font-medium text-background"
        >
          Browse subjects
        </Link>
        {user ? (
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-200 px-5 py-3 dark:border-zinc-800"
          >
            Dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg border border-zinc-200 px-5 py-3 dark:border-zinc-800"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg border border-zinc-200 px-5 py-3 dark:border-zinc-800"
            >
              Sign up
            </Link>
          </>
        )}
      </div>

      <p className="text-sm text-zinc-500">
        {user
          ? `Signed in as ${user.email}. Your progress is saved as you go.`
          : "You can browse and play everything without an account — signing in is only so your progress is saved."}
      </p>
    </main>
  );
}
