/** Logotype « Genki 元気 », dessiné dans Figma (page « 5 · Logos »). */
export function Logo({ height = 40 }: { height?: number }) {
  return (
    // SVG statique servi depuis /public : pas d'optimisation Next nécessaire.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/genki-logotype.svg" alt="Genki 元気" className="logo" height={height} width={Math.round((height * 2521) / 852)} />
  );
}
