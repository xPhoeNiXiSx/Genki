/** Couloirs de piste d'athlétisme, en filigrane derrière le contenu. */
export function Lanes({ centered = false }: { centered?: boolean }) {
  return (
    <svg className={centered ? "lanes centered" : "lanes"} viewBox="0 0 480 520" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((k) => {
        const inset = k * 22 + 1;
        return (
          <rect
            key={k}
            x={inset}
            y={inset}
            width={480 - inset * 2}
            height={520 - inset * 2}
            rx={240 - inset}
            fill="none"
            stroke="#1a1a1d"
            strokeOpacity="0.08"
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}
