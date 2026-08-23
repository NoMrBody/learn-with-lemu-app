"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Wordmark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "../actions";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <main className="grid-paper flex flex-1 flex-col items-center justify-center gap-8 px-5 py-16">
      <div className="flex w-full max-w-sm items-center justify-between">
        <Wordmark priority />
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-line bg-surface p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-h2">Sign up</h1>
          <p className="text-body-sm text-muted">
            Keeps your place across every topic. Nothing else.
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
              autoComplete="new-password"
              minLength={6}
              required
              aria-describedby="pw-hint"
              aria-invalid={state?.error ? true : undefined}
            />
            <p id="pw-hint" className="font-mono text-eyebrow text-faint">
              6 characters minimum
            </p>
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
            {pending ? "Signing up…" : "Sign up"}
          </Button>
        </form>
      </div>

      <p className="text-body-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="rounded-md font-medium text-brand-text underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </main>
  );
}
