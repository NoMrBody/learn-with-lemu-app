import Link from "next/link";
import { HomeLink } from "@/components/logo";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects unauthenticated requests to /login, but that
  // check only reads the cookie. This re-verifies with Supabase Auth, since
  // pages that fetch real data need the real check, not the optimistic one.
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-16">
      <header className="flex flex-col items-center gap-2">
        {/* Signing in lands here and logging out is the only other exit, so
            without this the page is a dead end for anyone not editing the URL. */}
        <HomeLink />
        <h1 className="text-3xl font-semibold">Dashboard</h1>
      </header>
      <p className="text-zinc-600">Signed in as {user.email}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/learn"
          className="rounded bg-zinc-900 px-3 py-2 text-white"
        >
          Browse subjects
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700"
          >
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}
