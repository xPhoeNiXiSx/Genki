"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Spinner } from "../../spinner";
import { Icon } from "../../ui/icons";
import { removeFromWatchAction, sendToWatchAction, type WatchState } from "../actions";

export type WatchDay = { value: string; label: string; date: string };

/**
 * « Envoyer à la montre » : on choisit le jour, la séance part dans le
 * calendrier intervals.icu, qui la transmet à Garmin Connect.
 */
export function WatchSheet({ sessionId, days, sentDay, sentLabel, connected }: { sessionId: string; days: WatchDay[]; sentDay: string | null; sentLabel: string | null; connected: boolean }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(sentDay ?? days[0]?.value ?? "");
  const [sent, send, sending] = useActionState<WatchState, FormData>(sendToWatchAction, {});
  const [removed, remove, removing] = useActionState<WatchState, FormData>(removeFromWatchAction, {});
  const error = sent.error ?? removed.error;

  // La page se recharge avec le nouvel état : on referme le panneau.
  useEffect(() => {
    if (sent.done || removed.done) setOpen(false);
  }, [sent, removed]);

  return (
    <>
      {sentLabel ? (
        <button type="button" onClick={() => setOpen(true)} className="galet" style={{ marginTop: 14, borderRadius: 22, display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}>
          <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", background: "var(--ink)", color: "var(--volt)", display: "grid", placeItems: "center" }}><Icon name="upload" size={16} /></span>
          <span style={{ flex: 1, display: "grid", gap: 2 }}>
            <strong>Sur la montre</strong>
            <span className="mono" style={{ fontSize: 12 }}>{sentLabel}</span>
          </span>
          <span className="mono" style={{ fontSize: 12, textDecoration: "underline" }}>changer</span>
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn" style={{ width: "100%", height: 48, borderRadius: 24, marginTop: 14, background: "transparent", color: "var(--ink)", border: "1.5px solid var(--ink)" }}>
          <Icon name="upload" size={18} /> Envoyer à la montre
        </button>
      )}

      {open ? (
        <div className="sheet-veil" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Envoyer à la montre">
            <h2 className="display" style={{ fontSize: 22 }}>Envoyer à la montre</h2>
            {connected ? (
              <>
                <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>La séance part dans ton calendrier intervals.icu, qui la passe à Garmin Connect : la montre la propose le jour venu, étape par étape.</p>
                <form action={send}>
                  <input type="hidden" name="id" value={sessionId} />
                  <span className="field-label">Quel jour ?</span>
                  <div role="radiogroup" aria-label="Jour" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                    {days.map((d) => (
                      <button key={d.value} type="button" role="radio" aria-checked={day === d.value} onClick={() => setDay(d.value)} className={day === d.value ? "chip on" : "chip"} style={{ height: 52, padding: 0, flexDirection: "column", justifyContent: "center", gap: 2, borderRadius: 18 }}>
                        <span>{d.label}</span>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 400 }}>{d.date}</span>
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="day" value={day} />
                  {error ? <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p> : null}
                  <button type="submit" className="btn wide volt" style={{ marginTop: 18 }} disabled={sending || removing || !day}>
                    {sending ? <Spinner /> : <Icon name="upload" size={20} />} {sending ? "Envoi…" : sentDay ? "Déplacer à ce jour" : "Envoyer"}
                  </button>
                </form>
                {sentDay ? (
                  <form action={remove}>
                    <input type="hidden" name="id" value={sessionId} />
                    <button type="submit" className="btn wide" style={{ marginTop: 10, background: "transparent", color: "var(--ink)", border: "1.5px solid var(--ink)" }} disabled={sending || removing}>
                      {removing ? <Spinner /> : <Icon name="close" size={18} />} Retirer de la montre
                    </button>
                  </form>
                ) : null}
                <p className="muted" style={{ margin: "14px 0 0", fontSize: 12 }}>Si rien n&apos;arrive sur la montre : dans intervals.icu, Settings → Garmin, coche l&apos;envoi des entraînements prévus (« Upload planned workouts »).</p>
              </>
            ) : (
              <>
                <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>L&apos;envoi passe par intervals.icu, relié à Garmin Connect. Relie-le d&apos;abord.</p>
                <Link href="/compte" className="btn wide volt" style={{ marginTop: 18 }}>Relier intervals.icu</Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
