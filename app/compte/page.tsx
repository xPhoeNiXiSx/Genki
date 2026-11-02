import Link from "next/link";

import { getSettings } from "@/lib/settings";
import { getStravaConnection, isStravaConfigured } from "@/lib/strava";

import { databaseBlocker } from "../db-screens";
import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { SettingsPanel } from "./settings-panel";

/** Message après un aller-retour vers Strava. */
const STRAVA_NOTICES: Record<string, string> = {
  ok: "✓ Strava est relié : tes sorties depuis le début du plan sont importées.",
  synchro: "✓ Synchro faite : les nouvelles sorties cochent le plan.",
  deconnecte: "✓ Strava est déconnecté. Les sorties déjà importées restent.",
  annule: "Connexion à Strava annulée.",
  droits: "Coche « voir les données de mes activités » dans Strava pour que Genki puisse les lire.",
  refus: "Lien de connexion expiré : recommence depuis ici.",
  config: "Strava n'est pas encore configuré côté Vercel.",
  erreur: "Strava n'a pas répondu. Réessaie dans un moment.",
};

const LAST_SYNC = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ migre?: string; strava?: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const [{ migre, strava: stravaParam }, settings, connection] = await Promise.all([searchParams, getSettings(), getStravaConnection()]);
  const strava = {
    configured: isStravaConfigured(),
    connected: connection !== null,
    athleteName: connection?.athleteName ?? null,
    lastSync: connection?.lastSyncAt ? LAST_SYNC.format(connection.lastSyncAt) : null,
    notice: (stravaParam && STRAVA_NOTICES[stravaParam]) || null,
  };

  return (
    <main className="screen bare">
      <Lanes />
      <div className="top-bar">
        <Link href="/" className="round" aria-label="Retour à l'accueil"><Icon name="back" size={20} /></Link>
      </div>
      <h1 className="display" style={{ fontSize: 34, marginTop: 18 }}>Réglages</h1>
      <p className="subtitle">せってい · à ta façon</p>
      <SettingsPanel initial={settings} migrated={Boolean(migre)} strava={strava} />
      <p className="mono muted" style={{ textAlign: "center", fontSize: 12, margin: "28px 0 0" }}>genki · v0.2 · 元気</p>
    </main>
  );
}
