import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/(auth)/actions";

export const metadata = { title: "Dashboard" };

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
    <>
      <AppHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-12 sm:px-6 sm:py-16">
        <header className="flex flex-col gap-3">
          <p className="font-mono text-eyebrow uppercase text-muted">Your account</p>
          <h1 className="text-h1">Dashboard</h1>
        </header>

        <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-eyebrow uppercase text-muted">Signed in as</span>
            <span className="font-mono text-body break-all text-fg">{user.email}</span>
          </div>
          <p className="text-body-sm text-muted">
            Progress is written as you finish each stage, so you can pick any topic back up
            where you left it.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
            <Button asChild>
              <Link href="/learn">Browse subjects</Link>
            </Button>
            <form action={logout}>
              <Button type="submit" variant="outline">
                Log out
              </Button>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
