"use client";

import { useState, useTransition } from "react";

import type { CatalogEntry, CatalogKind } from "@/lib/catalog";

import { changeCatalogAction, type CatalogChange } from "../catalog-actions";
import { Icon } from "./icons";

/**
 * Choix dans une liste que l'on gère soi-même (catégories, matériel) : des
 * pastilles, et un panneau pour ajouter, renommer ou supprimer une entrée.
 * Une entrée encore utilisée ne se supprime pas.
 */
export function CatalogPicker({
  kind,
  title,
  name,
  entries: initial,
  value,
  onChange,
  noneLabel,
}: {
  kind: CatalogKind;
  /** Titre du panneau de gestion : « Catégories », « Matériel »… */
  title: string;
  /** Nom du champ de formulaire, s'il en faut un. */
  name?: string;
  entries: CatalogEntry[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Libellé de la pastille « aucune valeur », si l'on peut ne rien choisir. */
  noneLabel?: string;
}) {
  const [entries, setEntries] = useState(initial);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function run(change: CatalogChange, after?: () => void) {
    startTransition(async () => {
      const state = await changeCatalogAction(kind, change);
      setEntries(state.entries);
      setError(state.error ?? null);
      if (!state.error) after?.();
    });
  }

  // Une valeur héritée absente de la liste reste affichée et choisie.
  const names = entries.map((e) => e.name);
  const shown = value && !names.includes(value) ? [...names, value] : names;

  return (
    <>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      <div className="choices">
        {noneLabel ? (
          <button type="button" className={value === null ? "chip on" : "chip"} aria-pressed={value === null} onClick={() => onChange(null)}>
            {noneLabel}
          </button>
        ) : null}
        {shown.map((n) => (
          <button key={n} type="button" className={value === n ? "chip on" : "chip"} aria-pressed={value === n} onClick={() => onChange(noneLabel && value === n ? null : n)}>
            {n}
          </button>
        ))}
        <button type="button" className="chip dashed" onClick={() => { setError(null); setOpen(true); }}>
          <Icon name="edit" size={14} /> Gérer
        </button>
      </div>

      {open ? (
        <div className="sheet-veil" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
            <h2 className="display" style={{ fontSize: 22 }}>{title}</h2>
            <p className="muted" style={{ margin: "6px 0 16px", fontSize: 13 }}>
              Renommer met à jour toutes les fiches. Une entrée utilisée ne peut pas être supprimée.
            </p>

            <div style={{ display: "grid", gap: 8 }}>
              {entries.map((entry) => (
                <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    className="input"
                    style={{ flex: 1, height: 46 }}
                    defaultValue={entry.name}
                    aria-label={`Renommer ${entry.name}`}
                    maxLength={40}
                    onBlur={(e) => {
                      const to = e.target.value.trim();
                      if (!to || to === entry.name) {
                        e.target.value = entry.name;
                        return;
                      }
                      run({ op: "rename", from: entry.name, to }, () => {
                        if (value === entry.name) onChange(to);
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <span className="mono muted" style={{ fontSize: 11, width: 52, textAlign: "right" }}>
                    {entry.uses > 0 ? `×${entry.uses}` : "libre"}
                  </span>
                  <button
                    type="button"
                    className="round"
                    disabled={entry.uses > 0 || pending}
                    style={entry.uses > 0 ? { opacity: 0.3 } : { color: "var(--danger)" }}
                    aria-label={entry.uses > 0 ? `${entry.name} est utilisé, impossible de le supprimer` : `Supprimer ${entry.name}`}
                    onClick={() => run({ op: "delete", name: entry.name }, () => {
                      if (value === entry.name) onChange(null);
                    })}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
              {entries.length === 0 ? <p className="muted" style={{ margin: 0, textAlign: "center" }}>Liste vide.</p> : null}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <input
                className="input"
                style={{ flex: 1, height: 46 }}
                placeholder="Nouvelle entrée"
                aria-label="Nouvelle entrée"
                maxLength={40}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (draft.trim()) run({ op: "add", name: draft }, () => { onChange(draft.trim().replace(/\s+/g, " ")); setDraft(""); });
                  }
                }}
              />
              <button
                type="button"
                className="round volt"
                disabled={!draft.trim() || pending}
                aria-label="Ajouter"
                onClick={() => run({ op: "add", name: draft }, () => { onChange(draft.trim().replace(/\s+/g, " ")); setDraft(""); })}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>

            {error ? <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}

            <button type="button" className="btn wide" style={{ marginTop: 20 }} onClick={() => setOpen(false)}>
              <Icon name="check" size={20} /> Terminé
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
