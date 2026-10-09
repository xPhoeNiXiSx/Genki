import Link from "next/link";

import { bestView } from "@/lib/anatomy";
import { listExercises } from "@/lib/exercises";

import { databaseBlocker } from "../db-screens";
import { BodyMap } from "../ui/body-map";
import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { TabBar } from "../ui/tab-bar";

const TILE_STYLES = ["galet ink", "galet alt", "galet alt", "galet volt", "galet", "galet alt"];

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { cat, q } = await searchParams;
  const all = await listExercises();
  const categories = [...new Set(all.map((e) => e.category))];
  const needle = q?.trim().toLowerCase() ?? "";
  const shown = all.filter(
    (e) => (!cat || e.category === cat) && (!needle || e.name.toLowerCase().includes(needle)),
  );
  const href = (c?: string) => {
    const params = new URLSearchParams();
    if (c) params.set("cat", c);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/exercices?${s}` : "/exercices";
  };

  return (
    <main className="screen">
      <Lanes />
      <Link href="/exercices/nouveau" className="round volt" aria-label="Créer un exercice" style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 20px)", right: 24, zIndex: 2 }}>
        <Icon name="plus" size={20} />
      </Link>
      <h1 className="display title">Exercices</h1>
      <p className="subtitle">
        エクササイズ · {all.length} exercice{all.length > 1 ? "s" : ""}
      </p>

      <form action="/exercices" style={{ marginTop: 20, position: "relative" }}>
        {cat ? <input type="hidden" name="cat" value={cat} /> : null}
        <span style={{ position: "absolute", left: 18, top: 15, color: "var(--grey)" }}><Icon name="search" size={18} /></span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher un exercice"
          aria-label="Rechercher un exercice"
          style={{ width: "100%", height: 48, borderRadius: 24, border: "1px solid var(--line)", background: "var(--white)", padding: "0 18px 0 46px", fontSize: 16 }}
        />
      </form>

      <nav style={{ display: "flex", gap: 8, overflowX: "auto", margin: "14px -24px 0", padding: "0 24px" }} aria-label="Catégories">
        <Link href={href()} className={!cat ? "chip on" : "chip"}>Tous</Link>
        {categories.map((c) => (
          <Link key={c} href={href(c)} className={cat === c ? "chip on" : "chip"}>{c}</Link>
        ))}
      </nav>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
        {shown.map((e, i) => {
          const style = TILE_STYLES[i % TILE_STYLES.length];
          const tone = style.includes("ink") ? "ink" : style.includes("volt") ? "volt" : "light";
          return (
            <Link key={e.id} href={`/exercices/${e.id}`} className={style} style={{ minHeight: 150, display: "grid", gridTemplateRows: "1fr auto", position: "relative" }}>
              <span style={{ position: "absolute", top: 8, right: 14 }}>
                <BodyMap view={bestView(e.muscles)} highlight={e.muscles} tone={tone} height={84} />
              </span>
              <span />
              <span>
                <span className="display" style={{ display: "block", fontSize: 15, lineHeight: 1.12, maxWidth: "70%" }}>{e.name}</span>
                <span style={{ display: "block", marginTop: 6, fontSize: 11, color: tone === "ink" ? "var(--volt)" : undefined, opacity: tone === "ink" ? 0.9 : 0.6 }}>
                  {e.category}{e.equipment ? ` · ${e.equipment}` : ""}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      {shown.length === 0 ? (
        <div className="galet" style={{ borderStyle: "dashed", textAlign: "center", marginTop: 18 }}>
          {all.length === 0 ? "La bibliothèque est encore vide." : "Aucun exercice ne correspond."}
        </div>
      ) : null}

      <TabBar />
    </main>
  );
}
