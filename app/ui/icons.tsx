/**
 * Icônes au trait, 24 × 24, couleur héritée du texte (`currentColor`).
 */

type IconProps = { size?: number; strokeWidth?: number };

const PATHS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  dumbbell: <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />,
  list: <path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  chart: <path d="M5 20v-8M12 20V5M19 20v-5" />,
  metronome: (
    <>
      <path d="M9 3h6l4 18H5z" />
      <path d="M12 16 16.5 6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  back: <path d="M15 18l-6-6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  prev: (
    <>
      <path d="M18 5 9 12l9 7z" />
      <path d="M6 5v14" />
    </>
  ),
  next: (
    <>
      <path d="M6 5l9 7-9 7z" />
      <path d="M18 5v14" />
    </>
  ),
  pause: <path d="M9 5v14M15 5v14" />,
  speaker: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-8 8" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS | "play";

export function Icon({ name, size = 22, strokeWidth = 2 }: IconProps & { name: IconName }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "play" ? <path d="M8 5v14l11-7z" fill="currentColor" /> : PATHS[name]}
    </svg>
  );
}
