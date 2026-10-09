import { HEAD, OUTLINE, UNDERLAY, VIEWBOX, musclesOf, type View } from "@/lib/anatomy";
import type { MuscleKey } from "@/lib/muscles";

/**
 * Planche anatomique : les muscles travaillés en volt, les autres en gris
 * ardoise, séparés par un trait blanc. Les traits gardent la même finesse à
 * toutes les tailles (`non-scaling-stroke`).
 */

const TONES = {
  light: { base: "#5d6470", sep: "#ffffff", skin: "#ffffff", skinLine: "#9c9b93", on: "#d7ff3e", onLine: "#1a1a1d" },
  ink: { base: "#4a4a50", sep: "#1a1a1d", skin: "#2e2e33", skinLine: "#55555b", on: "#d7ff3e", onLine: "#d7ff3e" },
  volt: { base: "#9fb92a", sep: "#d7ff3e", skin: "#d7ff3e", skinLine: "#8aa31d", on: "#1a1a1d", onLine: "#1a1a1d" },
} as const;

export function BodyMap({
  view,
  highlight,
  tone = "light",
  height,
  label,
  onToggle,
}: {
  view: View;
  highlight: MuscleKey[];
  tone?: keyof typeof TONES;
  height: number;
  label?: string;
  /** Rend chaque muscle touchable (formulaire d'exercice). */
  onToggle?: (key: MuscleKey) => void;
}) {
  const c = TONES[tone];
  const muscles = Object.entries(musclesOf(view)) as [MuscleKey, string[]][];
  const on = new Set(highlight);
  const width = (height * VIEWBOX.width) / VIEWBOX.height;

  // Moitié dessinée, puis son miroir.
  const both = (content: React.ReactNode) => (
    <>
      <g>{content}</g>
      <g transform={`translate(${VIEWBOX.width} 0) scale(-1 1)`}>{content}</g>
    </>
  );
  const paths = (list: string[], key?: MuscleKey) =>
    list.map((d) => (
      <path key={d} d={d} vectorEffect="non-scaling-stroke" onClick={key && onToggle ? () => onToggle(key) : undefined} />
    ));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={onToggle ? "body-map-touch" : undefined}
    >
      <g fill={c.base}>{both(paths(UNDERLAY))}</g>
      <g fill={c.base} stroke={c.sep} strokeWidth="1" strokeLinejoin="round">
        {both(muscles.filter(([key]) => !on.has(key)).map(([key, list]) => <g key={key}>{paths(list, key)}</g>))}
      </g>
      <g fill={c.on} stroke={c.onLine} strokeWidth="1.1" strokeLinejoin="round">
        {both(muscles.filter(([key]) => on.has(key)).map(([key, list]) => <g key={key}>{paths(list, key)}</g>))}
      </g>
      <g fill={c.skin} stroke={c.skinLine} strokeWidth="1" strokeLinejoin="round" pointerEvents="none">
        <ellipse cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} vectorEffect="non-scaling-stroke" />
        {both(paths(OUTLINE[view]))}
      </g>
    </svg>
  );
}
