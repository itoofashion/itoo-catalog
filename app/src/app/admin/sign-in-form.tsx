"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signIn, type SignInState } from "./actions";

const EMPTY: SignInState = { error: null };

export function SignInForm() {
  const [state, submit, pending] = useActionState(signIn, EMPTY);

  return (
    <form action={submit} className="flex flex-col gap-3">
      <label htmlFor="password" className="sr-only">
        Team password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        required
        placeholder="Password"
        className="h-11 w-full rounded-sm border border-border bg-card px-4 text-base outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      {state.error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
