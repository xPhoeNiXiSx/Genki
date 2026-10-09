import Link from "next/link";

import { getSettings } from "@/lib/settings";

import { databaseBlocker } from "../db-screens";
import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { SettingsPanel } from "./settings-panel";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ migre?: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const [{ migre }, settings] = await Promise.all([searchParams, getSettings()]);

  return (
    <main className="screen bare">
      <Lanes />
      <div className="top-bar">
        <Link href="/" className="round" aria-label="Retour à l'accueil"><Icon name="back" size={20} /></Link>
      </div>
      <h1 className="display" style={{ fontSize: 34, marginTop: 18 }}>Réglages</h1>
      <p className="subtitle">せってい · à ta façon</p>
      <SettingsPanel initial={settings} migrated={Boolean(migre)} />
      <p className="mono muted" style={{ textAlign: "center", fontSize: 12, margin: "28px 0 0" }}>genki · v0.2 · 元気</p>
    </main>
  );
}
