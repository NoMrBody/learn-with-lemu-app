import Link from "next/link";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * The shared bar on every page that is a page rather than a stage.
 *
 * The three stage routes deliberately don't use it — they are full-viewport
 * and the progress rail is their only chrome, so it carries the theme toggle
 * instead. See components/progress-rail.tsx.
 */
export async function AppHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 flex-none border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Wordmark priority />

        <nav className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/learn">Subjects</Link>
          </Button>
          {user ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            // Sign-up is the only coloured thing in the bar, so it reads as
            // the one invitation rather than one of four equal links.
            <>
              <Button asChild variant="ghost" size="sm" className="max-sm:hidden">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </nav>

        <ThemeToggle className="ml-0.5 sm:ml-1" />
      </div>
    </header>
  );
}
