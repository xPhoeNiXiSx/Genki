"use client";

import { useActionState } from "react";

import { loginAction, type LoginState } from "./actions";
import { Spinner } from "../spinner";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    loginAction,
    {},
  );

  return (
    <form action={action} className="panel form">
      <input type="hidden" name="next" value={next} />

      <label>
        Mot de passe
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </label>

      {state.error ? <p className="error">{state.error}</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? (
          <>
            <Spinner />
            Vérification…
          </>
        ) : (
          "Se connecter"
        )}
      </button>
    </form>
  );
}
