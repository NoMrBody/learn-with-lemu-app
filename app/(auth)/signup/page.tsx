"use client";

import Link from "next/link";
import { HomeLink } from "@/components/logo";
import { useActionState } from "react";
import { signup } from "../actions";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-16">
      <header className="flex flex-col items-center gap-2">
        <HomeLink />
        <h1 className="text-3xl font-semibold">Sign up</h1>
      </header>
      <form action={action} className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={6}
            required
            className="rounded border border-zinc-300 px-3 py-2"
          />
        </div>
        {state?.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        <button
          disabled={pending}
          type="submit"
          className="rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Signing up…" : "Sign up"}
        </button>
      </form>
      <p className="text-sm text-zinc-600">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
