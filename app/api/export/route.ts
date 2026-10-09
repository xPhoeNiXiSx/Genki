import { isAuthenticated } from "@/lib/auth";
import { exportData } from "@/lib/backup";
import { parisToday } from "@/lib/dates";

/** Télécharge toutes les données en JSON : « genki-2026-10-09.json ». */
export async function GET() {
  if (!(await isAuthenticated())) return new Response("Non connecté.", { status: 401 });
  const backup = await exportData();
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="genki-${parisToday()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
