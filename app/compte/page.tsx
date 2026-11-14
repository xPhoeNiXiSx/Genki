import Link from "next/link";

import { getSettings } from "@/lib/settings";
import { getIntervalsConnection } from "@/lib/intervals";

import { databaseBlocker } from "../db-screens";
import { Icon, type IconName } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { SettingsPanel } from "./settings-panel";

/** Message après une action sur intervals.icu. */
const SYNC_NOTICES: Record<string, string> = {
  ok: "✓ intervals.icu est relié : tes sorties depuis le début du plan sont importées.",
  relie: "✓ intervals.icu est relié. Le premier import n'a pas abouti : relance une synchro.",
  synchro: "✓ Synchro faite : les nouvelles sorties cochent le plan.",
  deconnecte: "✓ intervals.icu est déconnecté. Les sorties déjà importées restent.",
  erreur: "intervals.icu n'a pas répondu. Réessaie dans un moment.",
};

/** Les pages d'avant le plan, toujours là mais hors du menu. */
const TOOLS: { href: string; label: string; detail: string; icon: IconName }[] = [
  { href: "/exercices", label: "Exercices", detail: "la bibliothèque, avec les fiches du renfo", icon: "dumbbell" },
  { href: "/programmes", label: "Séances libres", detail: "tes enchaînements chronométrés", icon: "list" },
  { href: "/suivi", label: "Suivi des séances libres", detail: "l'historique, pour le kiné", icon: "chart" },
  { href: "/metronome", label: "Métronome", detail: "caler sa cadence", icon: "metronome" },
];

const LAST_SYNC = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ migre?: string; sync?: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const [{ migre, sync }, settings, connection] = await Promise.all([searchParams, getSettings(), getIntervalsConnection()]);
  const intervals = {
    connected: connection !== null,
    athleteName: connection?.athleteName ?? null,
    lastSync: connection?.lastSyncAt ? LAST_SYNC.format(connection.lastSyncAt) : null,
    notice: (sync && SYNC_NOTICES[sync]) || null,
  };

  return (
    <main className="screen bare">
      <Lanes />
      <div className="top-bar">
        <Link href="/" className="round" aria-label="Retour à l'accueil"><Icon name="back" size={20} /></Link>
      </div>
      <h1 className="display" style={{ fontSize: 34, marginTop: 18 }}>Réglages</h1>
      <p className="subtitle">せってい · à ta façon</p>
      <SettingsPanel initial={settings} migrated={Boolean(migre)} intervals={intervals} />

      <span className="field-label">Outils</span>
      <div className="settings">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="setting-row">
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Icon name={t.icon} size={20} />
              <span style={{ display: "grid", gap: 2 }}>
                <strong style={{ fontSize: 15 }}>{t.label}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{t.detail}</span>
              </span>
            </span>
            <Icon name="chevron" size={16} />
          </Link>
        ))}
      </div>
      <p className="mono muted" style={{ textAlign: "center", fontSize: 12, margin: "28px 0 0" }}>genki · v0.2 · 元気</p>
    </main>
  );
}
