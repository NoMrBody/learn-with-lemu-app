"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "../actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <main className="grid-paper flex flex-1 flex-col items-center justify-center gap-8 px-5 py-16">
      <div className="flex w-full max-w-sm items-center justify-between">
        <Wordmark priority />
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-line bg-surface p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-h2">Log in</h1>
          <p className="text-body-sm text-muted">
            Only so your progress is kept — everything is free to browse either way.
          </p>
        </header>

        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={state?.error ? true : undefined}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={state?.error ? true : undefined}
            />
          </div>
          {state?.error && (
            <p
              role="alert"
              className="rounded-lg border border-error/40 bg-error-soft px-3 py-2 text-body-sm text-error"
            >
              {state.error}
            </p>
          )}
          <Button disabled={pending} type="submit" size="lg" className="mt-1 w-full">
            {pending ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </div>

      <p className="text-body-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="rounded-md font-medium text-brand-text underline-offset-4 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </main>
  );
}
