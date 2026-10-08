import { sinceLabel } from "@/lib/dates";
import { getProgram, listPrograms, type Program } from "@/lib/programs";

import { databaseBlocker } from "../db-screens";
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
        {programs.length === 0 ? (
          <div className="galet" style={{ borderStyle: "dashed", textAlign: "center" }}>
            Aucun programme pour l&apos;instant.
          </div>
        ) : null}
      </div>

      <TabBar />
    </main>
  );
}
