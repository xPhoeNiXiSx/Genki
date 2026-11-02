"use client";

import { useFormStatus } from "react-dom";

import { Spinner } from "./spinner";

/**
 * Bouton d'envoi d'un formulaire d'action serveur, qui montre qu'il travaille :
 * anneau qui tourne, libellé « en cours », et désactivé le temps de la
 * réponse — un second appui ne relance pas l'action.
 *
 * Il lit l'état du formulaire qui l'entoure (`useFormStatus`) : il doit donc
 * être posé *dans* le `<form>`.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  style,
}: {
  children: React.ReactNode;
  /** Ce qu'affiche le bouton pendant l'action : « Enregistrement… ». */
  pendingLabel: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      style={style}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
