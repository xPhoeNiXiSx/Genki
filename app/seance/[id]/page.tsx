import { notFound } from "next/navigation";

import { getProgram } from "@/lib/programs";

import { databaseBlocker } from "../../db-screens";
import { SessionPlayer } from "./session-player";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const blocked = await databaseBlocker();
  if (blocked) return blocked;

  const { id } = await params;
  const program = UUID.test(id) ? await getProgram(id) : null;
  if (!program || program.steps.length === 0) notFound();

  return <SessionPlayer program={program} />;
}
