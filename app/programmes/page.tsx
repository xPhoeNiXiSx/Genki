import Link from "next/link";

import { sinceLabel } from "@/lib/dates";
import { getProgram, listPrograms, type Program } from "@/lib/programs";

import { databaseBlocker } from "../db-screens";
import { Icon } from "../ui/icons";
import { Lanes } from "../ui/lanes";
import { ProgramBib } from "../ui/program-bib";
import { TabBar } from "../ui/tab-bar";

export default async function ProgramsPage() {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const summaries = await listPrograms();
  const programs = (await Promise.all(summaries.map((s) => getProgram(s.id)))).filter((p): p is Program => p !== null);

  return (
    <main className="screen">
      <Lanes />
      <Link href="/programmes/nouveau" className="round volt" aria-label="Créer un programme" style={{ position: "absolute", top: "calc(env(safe-area-inset-top) + 20px)", right: 24, zIndex: 2 }}>
        <Icon name="plus" size={20} />
      </Link>
      <h1 className="display title">Programmes</h1>
      <p className="subtitle">
        プログラム · {programs.length} programme{programs.length > 1 ? "s" : ""}
      </p>

      <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
        {programs.map((program, i) => (
          <ProgramBib
            key={program.id}
            program={program}
            number={i + 1}
            band={i === 0 ? "Séance du jour" : sinceLabel(summaries[i].lastDoneAt)}
            hero={i === 0}
          />
        ))}
        <Link href="/programmes/nouveau" className="galet" style={{ border: "1.5px dashed rgba(26,26,29,.45)", background: "transparent", borderRadius: 24, display: "flex", justifyContent: "center", alignItems: "center", gap: 10, minHeight: 64, fontWeight: 900 }}>
          <Icon name="plus" size={20} /> Créer un programme
        </Link>
      </div>

      <TabBar />
    </main>
  );
}
