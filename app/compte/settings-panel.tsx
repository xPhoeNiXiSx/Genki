"use client";

import { useActionState, useRef, useState } from "react";

import { SOUNDS } from "@/lib/programs";
import type { SettingKey, Settings } from "@/lib/settings";

import { logoutAction } from "../login/actions";
import { SubmitButton } from "../submit-button";
import { ConfirmDelete } from "../ui/confirm-delete";
import { Icon } from "../ui/icons";
import { connectIntervalsAction, disconnectIntervalsAction, importAction, migrateAction, saveSettingAction, syncIntervalsAction, type ImportState, type IntervalsState } from "./actions";

const TOGGLES: { key: Exclude<SettingKey, "signalSound">; label: string; hint: string }[] = [
  { key: "signal", label: "Signal sonore", hint: "à chaque changement d'étape" },
  { key: "voice", label: "Décompte vocal", hint: "« trois, deux, un »" },
  { key: "vibration", label: "Vibrations", hint: "sur les changements d'étape" },
  { key: "keepAwake", label: "Écran toujours allumé", hint: "pendant la séance" },
];

/** Interrupteur : pastille volt bordée d'encre quand il est activé. */
function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      style={{ width: 46, height: 28, flex: "none", borderRadius: 14, padding: 3, border: on ? "1.5px solid var(--ink)" : "1.5px solid var(--soft)", background: on ? "var(--volt)" : "var(--soft)", display: "flex", justifyContent: on ? "flex-end" : "flex-start", cursor: "pointer", transition: "background 120ms" }}
    >
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: on ? "var(--ink)" : "var(--white)" }} />
    </button>
  );
}

export type IntervalsPanelState = {
  athleteName: string | null;
  connected: boolean;
  lastSync: string | null;
  notice: string | null;
};

export function SettingsPanel({ initial, migrated, intervals }: { initial: Settings; migrated: boolean; intervals: IntervalsPanelState }) {
  const [settings, setSettings] = useState(initial);
  const [soundSheet, setSoundSheet] = useState(false);
  const [intervalsSheet, setIntervalsSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importState, importFormAction, importing] = useActionState<ImportState, FormData>(importAction, {});
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const importForm = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function change<K extends SettingKey>(key: K, value: Settings[K]) {
    const previous = settings[key];
    setSettings((s) => ({ ...s, [key]: value }));
    const result = await saveSettingAction(key, value).catch(() => ({ ok: false }));
    if (!result.ok) {
      setSettings((s) => ({ ...s, [key]: previous }));
      setError("Réglage non enregistré. Réessaie.");
    } else setError(null);
  }

  return (
    <>
      <span className="field-label">Séance</span>
      <div className="settings">
        {TOGGLES.map((t) => (
          <div key={t.key} className="setting-row" style={{ cursor: "default" }}>
            <span>
              <span style={{ display: "block", fontWeight: 900 }}>{t.label}</span>
              <span className="muted" style={{ fontSize: 12 }}>{t.hint}</span>
            </span>
            <Switch on={settings[t.key]} label={t.label} onToggle={() => change(t.key, !settings[t.key])} />
          </div>
        ))}
      </div>
      <div className="settings" style={{ marginTop: 10 }}>
        <button type="button" className="setting-row" onClick={() => setSoundSheet(true)}>
          <span style={{ fontWeight: 900 }}>Son du signal</span>
          <span className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {SOUNDS.find((s) => s.key === settings.signalSound)?.label} <Icon name="chevron" size={18} />
          </span>
        </button>
      </div>
      {error ? <p className="error" role="alert" style={{ marginTop: 10 }}>{error}</p> : null}

      <span className="field-label">Intégrations</span>
      <div className="settings">
        <div className="setting-row" style={{ cursor: "default" }}>
          <span>
            <span style={{ display: "block", fontWeight: 900 }}>intervals.icu</span>
            <span className="muted" style={{ fontSize: 12 }}>
              {intervals.connected
                ? `${intervals.athleteName ?? "compte relié"} · ${intervals.lastSync ? `synchro ${intervals.lastSync}` : "pas encore synchronisé"}`
                : "importe tes sorties et coche le plan"}
            </span>
          </span>
          {intervals.connected ? (
            <form action={syncIntervalsAction}>
              <SubmitButton className="chip" style={{ height: 32, fontSize: 12 }} pendingLabel="Synchro…">Synchroniser</SubmitButton>
            </form>
          ) : (
            <button type="button" className="chip on" style={{ height: 32, fontSize: 12 }} onClick={() => setIntervalsSheet(true)}>Relier</button>
          )}
        </div>
        <div className="setting-row" style={{ cursor: "default" }}>
          <span>
            <span style={{ display: "block", fontWeight: 900 }}>Garmin Connect</span>
            <span className="muted" style={{ fontSize: 12 }}>relie Garmin à intervals.icu (Settings → Connections) : tes sorties arrivent ici par là</span>
          </span>
          <span className="chip" style={{ height: 26, fontSize: 11 }}>via intervals</span>
        </div>
      </div>
      {intervals.notice ? <p className={intervals.notice.startsWith("✓") ? "muted" : "error"} role="status" style={{ marginTop: 10 }}>{intervals.notice}</p> : null}
      {intervals.connected ? (
        <ConfirmDelete
          action={disconnectIntervalsAction}
          title="Déconnecter intervals.icu ?"
          message="Les nouvelles sorties ne seront plus importées. Celles déjà importées restent sur le plan."
          confirmLabel="Déconnecter"
          className="btn"
          style={{ background: "transparent", color: "var(--grey)", width: "100%", height: 44, marginTop: 6 }}
        >
          Déconnecter intervals.icu
        </ConfirmDelete>
      ) : null}
      {intervalsSheet ? <IntervalsSheet onClose={() => setIntervalsSheet(false)} /> : null}

      <span className="field-label">Données</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <a href="/api/export" download className="btn volt" style={{ background: "var(--white)", borderColor: "var(--line)", height: 56, borderRadius: 28 }}>
          <Icon name="download" size={18} /> Exporter
        </a>
        <button type="button" className="btn volt" style={{ background: "var(--white)", borderColor: "var(--line)", height: 56, borderRadius: 28 }} onClick={() => fileInput.current?.click()} disabled={importing}>
          <Icon name="upload" size={18} /> Importer
        </button>
      </div>
      <form ref={importForm} action={importFormAction}>
        <input
          ref={fileInput}
          type="file"
          name="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
        />
      </form>
      {importState.error ? <p className="error" role="alert" style={{ marginTop: 10 }}>{importState.error}</p> : null}
      {importState.done ? <p role="status" style={{ marginTop: 10, fontWeight: 700 }}>{importState.done}</p> : null}

      <span className="field-label">Compte</span>
      <form action={migrateAction} className="settings">
        <div className="setting-row" style={{ cursor: "default" }}>
          <span>
            <span style={{ display: "block", fontWeight: 900 }}>Base de données</span>
            <span className="muted" style={{ fontSize: 12 }}>{migrated ? "migrations appliquées" : "met à jour les tables, sans rien supprimer"}</span>
          </span>
          <SubmitButton className="chip" pendingLabel="…">Appliquer</SubmitButton>
        </div>
      </form>
      <form action={logoutAction} style={{ marginTop: 10 }}>
        <button type="submit" className="btn wide" style={{ background: "transparent", color: "var(--ink)", border: "1.5px solid var(--line)" }}>Se déconnecter</button>
      </form>

      {soundSheet ? (
        <div className="sheet-veil" onClick={() => setSoundSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Son du signal">
            <h2 className="display" style={{ fontSize: 22 }}>Son du signal</h2>
            <p className="muted" style={{ margin: "6px 0 16px" }}>Pour le décompte et la fin de séance. Chaque séance garde son propre son de transition.</p>
            <div className="choices">
              {SOUNDS.map((s) => (
                <button key={s.key} type="button" className={settings.signalSound === s.key ? "chip on" : "chip"} onClick={() => change("signalSound", s.key)}>{s.label}</button>
              ))}
            </div>
            <button type="button" className="btn wide" style={{ marginTop: 22 }} onClick={() => setSoundSheet(false)}>
              <Icon name="check" size={20} /> Valider
            </button>
          </div>
        </div>
      ) : null}

      {pendingFile ? (
        <div className="sheet-veil" onClick={() => setPendingFile(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label="Confirmer la restauration">
            <h2 className="display" style={{ fontSize: 22 }}>Remplacer tes données ?</h2>
            <p style={{ margin: "10px 0 0", lineHeight: 1.45 }}>
              Le fichier <strong>{pendingFile.name}</strong> va remplacer tous tes exercices, séances, historique et réglages actuels. Pense à exporter d&apos;abord si tu veux les garder.
            </p>
            <button
              type="button"
              className="btn wide"
              style={{ marginTop: 22 }}
              onClick={() => {
                setPendingFile(null);
                importForm.current?.requestSubmit();
              }}
            >
              <Icon name="upload" size={18} /> Restaurer ce fichier
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: "transparent", color: "var(--ink)", width: "100%", marginTop: 6 }}
              onClick={() => {
                setPendingFile(null);
                if (fileInput.current) fileInput.current.value = "";
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Saisie de l'ID athlète et de la clé API d'intervals.icu. */
function IntervalsSheet({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState<IntervalsState, FormData>(connectIntervalsAction, {});
  return (
    <div className="sheet-veil" onClick={onClose}>
      <form action={action} className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Relier intervals.icu">
        <h2 className="display" style={{ fontSize: 22 }}>Relier intervals.icu</h2>
        <ol className="muted" style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
          <li>Crée un compte gratuit sur <a href="https://intervals.icu" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>intervals.icu</a> et relie Garmin (Settings → Connections).</li>
          <li>Dans Settings → Developer Settings, copie ton <strong>ID athlète</strong> et génère une <strong>clé API</strong>.</li>
        </ol>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="field-label">ID athlète</span>
          <input name="athlete" className="input mono" placeholder="i123456" autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="field-label">Clé API</span>
          <input name="key" className="input mono" type="password" required autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </label>
        {state.error ? <p className="error" role="alert" style={{ marginTop: 12 }}>{state.error}</p> : null}
        <button type="submit" className="btn wide" style={{ marginTop: 18 }} disabled={pending}>
          {pending ? "Vérification…" : "Relier et importer"}
        </button>
      </form>
    </div>
  );
}
