import { query } from "@/lib/db";
import { SOUNDS, type SoundKey } from "@/lib/programs";

/**
 * Réglages de la séance. Chaque réglage a une valeur par défaut : la base ne
 * stocke que ceux que l'utilisateur a changés.
 */
export type Settings = {
  /** Bip à chaque changement d'étape. */
  signal: boolean;
  /** « trois, deux, un » à voix haute avant chaque changement. */
  voice: boolean;
  /** Vibration aux changements d'étape, là où le téléphone le permet. */
  vibration: boolean;
  /** Écran maintenu allumé pendant la séance. */
  keepAwake: boolean;
  /** Son des signaux qui ne dépendent pas du programme (décompte, fin). */
  signalSound: SoundKey;
};

export const DEFAULT_SETTINGS: Settings = {
  signal: true,
  voice: true,
  vibration: false,
  keepAwake: true,
  signalSound: "gong",
};

export type SettingKey = keyof Settings;

/** Vérifie une valeur avant de l'enregistrer ; `null` si elle est refusée. */
export function validSetting<K extends SettingKey>(key: K, value: unknown): Settings[K] | null {
  if (!(key in DEFAULT_SETTINGS)) return null;
  if (key === "signalSound") return SOUNDS.some((s) => s.key === value) ? (value as Settings[K]) : null;
  return typeof value === "boolean" ? (value as Settings[K]) : null;
}

export async function getSettings(): Promise<Settings> {
  const rows = await query<{ key: string; value: unknown }>(`select key, value from settings`);
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const key = row.key as SettingKey;
    const value = validSetting(key, row.value);
    if (value !== null) (settings as Record<SettingKey, unknown>)[key] = value;
  }
  return settings;
}

export async function saveSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<void> {
  await query(
    `insert into settings (key, value, updated_at) values ($1, $2::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}
