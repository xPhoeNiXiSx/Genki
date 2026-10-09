"use client";

import { useState } from "react";

import { Icon } from "./icons";

/**
 * Bouton de suppression qui demande confirmation dans un panneau : une
 * suppression ne part jamais d'un seul toucher.
 *
 * Hors formulaire, le panneau porte son propre formulaire et ses champs
 * cachés. Dans un formulaire (`nested`), le bouton de confirmation soumet le
 * formulaire parent vers `action` : on n'imbrique pas deux formulaires.
 */
export function ConfirmDelete({
  action,
  fields = {},
  nested = false,
  title,
  message,
  confirmLabel = "Supprimer",
  className,
  style,
  children,
}: {
  action: (form: FormData) => void | Promise<void>;
  fields?: Record<string, string>;
  nested?: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Contenu du bouton qui ouvre le panneau. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const confirm = (
    <button
      type="submit"
      formAction={nested ? action : undefined}
      formNoValidate={nested || undefined}
      className="btn wide"
      style={{ marginTop: 20, background: "var(--danger)", borderColor: "var(--danger)", color: "var(--white)" }}
    >
      <Icon name="trash" size={18} /> {confirmLabel}
    </button>
  );

  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open ? (
        <div className="sheet-veil" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={title}>
            <h2 className="display" style={{ fontSize: 22 }}>{title}</h2>
            <p className="muted" style={{ margin: "8px 0 0" }}>{message}</p>
            {nested ? (
              confirm
            ) : (
              <form action={action}>
                {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
                {confirm}
              </form>
            )}
            <button type="button" className="btn" style={{ background: "transparent", color: "var(--ink)", width: "100%", marginTop: 6 }} onClick={() => setOpen(false)}>
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
