import type { MuscleKey } from "@/lib/muscles";

/**
 * Planche anatomique : le corps de face et de dos, un tracé par muscle.
 *
 * Coordonnées dans un cadre de 200 × 430. Seule la moitié gauche est décrite
 * (x < 100) ; l'autre moitié est son miroir. Chaque tracé est rangé sous la
 * clé du groupe musculaire de `lib/muscles.ts`, ce qui permet d'allumer
 * directement les muscles d'un exercice.
 */

export type View = "face" | "dos";

export const VIEWBOX = { width: 200, height: 430 };

/** Silhouette pleine, sous les muscles : comble les jours entre deux tracés. */
export const UNDERLAY: string[] = [
  "M100 60 L92 60 C90 68 86 72 80 74 C66 78 50 78 42 84 C50 90 56 102 59 122 C59 150 60 180 62 206 C56 224 55 262 64 300 L66 318 C64 340 64 366 70 392 L84 392 C88 366 92 340 92 318 L92 300 C94 270 98 240 99 226 L100 226 Z",
  "M42 84 C34 92 33 106 35 120 C33 140 34 156 38 168 C32 186 28 206 27 228 L45 230 C49 210 53 190 55 170 C56 158 57 140 57 122 C55 104 50 92 42 84 Z",
];

export const FRONT: Partial<Record<MuscleKey, string[]>> = {
  trapezes: [
    "M86 64 C82 72 72 78 56 81 L80 85 L90 76 Z",
    "M91 60 L99 80 L99 84 L94 82 L87 66 Z",
  ],
  epaules: [
    "M56 81 C44 83 36 95 36 112 C37 121 41 127 45 130 C49 116 54 104 62 94 C65 88 62 83 56 81 Z",
  ],
  pectoraux: [
    "M62 94 C66 88 72 85 80 85 C90 84 96 85 99 86 L99 124 C88 131 72 129 58 121 C57 110 58 100 62 94 Z",
  ],
  triceps: [
    "M37 118 C33 134 34 152 38 166 L41 166 C39 152 40 138 44 129 Z",
  ],
  biceps: [
    "M45 130 C40 141 39 154 41 166 C46 170 52 168 55 160 C58 148 58 134 58 121 C53 126 49 129 45 130 Z",
  ],
  "avant-bras": [
    "M40 168 C34 182 30 202 28 226 L33 228 C35 206 38 186 44 170 Z",
    "M44 170 C40 190 36 210 34 228 L39 229 C42 208 46 190 50 172 Z",
    "M50 172 C48 190 44 210 40 229 L45 229 C50 210 54 190 55 168 Z",
  ],
  obliques: [
    "M58 121 C60 141 60 161 62 180 C64 193 68 203 74 210 L85 206 L85 150 C76 148 66 141 60 123 Z",
    "M60 125 L72 132 L71 138 L60 132 Z",
    "M60 136 L73 143 L72 149 L61 144 Z",
  ],
  abdominaux: [
    "M85 126 L99 126 L99 147 L85 147 Z",
    "M85 149 L99 149 L99 169 L85 169 Z",
    "M85 171 L99 171 L99 191 L85 191 Z",
    "M85 193 L99 193 L99 216 C93 216 88 212 85 206 Z",
  ],
  quadriceps: [
    "M58 214 C56 240 58 270 66 298 L72 300 C70 270 68 240 66 214 Z",
    "M66 212 C74 216 82 220 86 224 C86 250 82 276 78 298 L72 300 C72 270 70 240 66 212 Z",
    "M84 262 C90 272 92 286 88 298 L79 300 C82 288 84 276 84 262 Z",
    "M63 208 C74 230 84 260 90 292 L86 294 C80 262 70 232 59 212 Z",
  ],
  adducteurs: [
    "M86 223 C92 221 96 219 99 217 L99 226 C96 246 92 262 88 274 C86 258 86 240 86 223 Z",
  ],
  mollets: [
    "M66 322 C62 340 63 360 68 380 L70 380 C67 360 67 340 68 322 Z",
    "M68 320 C66 344 68 368 72 390 L77 390 C76 366 75 342 74 320 Z",
    "M74 320 L80 320 C81 340 81 362 80 390 L77 390 C76 366 75 342 74 320 Z",
    "M80 320 C90 330 92 352 88 370 C86 378 82 378 80 372 C81 356 81 338 80 320 Z",
  ],
};

export const BACK: Partial<Record<MuscleKey, string[]>> = {
  trapezes: [
    "M100 56 C94 64 84 72 58 81 C70 87 88 106 100 142 Z",
  ],
  epaules: [
    "M58 81 C44 83 36 95 36 112 C37 121 41 127 45 130 C49 116 56 102 66 92 Z",
    "M66 92 C76 92 86 98 90 108 C84 116 74 118 64 114 C62 106 62 98 66 92 Z",
  ],
  dorsaux: [
    "M64 116 C72 120 80 120 86 118 L84 126 C76 128 68 126 62 122 Z",
    "M62 124 C70 130 84 133 99 142 L99 186 C86 180 72 168 64 150 C60 140 60 130 62 124 Z",
  ],
  lombaires: [
    "M88 170 C92 172 96 174 99 176 L99 206 C94 208 88 206 86 200 C86 190 86 180 88 170 Z",
  ],
  obliques: [
    "M62 150 C66 166 74 180 86 190 L86 206 C74 206 66 200 62 190 C60 176 60 162 62 150 Z",
  ],
  triceps: [
    "M37 118 C33 134 34 152 38 166 L46 168 C48 152 48 136 46 128 Z",
    "M46 128 C50 140 52 154 50 168 L56 166 C58 150 58 134 57 121 Z",
  ],
  "avant-bras": [
    "M40 168 C34 182 30 202 28 226 L33 228 C35 206 38 186 44 170 Z",
    "M44 170 C40 190 36 210 34 228 L39 229 C42 208 46 190 50 172 Z",
    "M50 172 C48 190 44 210 40 229 L45 229 C50 210 54 190 55 168 Z",
  ],
  fessiers: [
    "M60 206 C68 199 84 199 94 207 C82 211 70 213 60 217 Z",
    "M60 217 C72 213 86 209 99 210 L99 256 C88 263 72 263 62 251 C58 239 58 227 60 217 Z",
  ],
  "ischio-jambiers": [
    "M60 253 C68 259 76 263 80 263 C80 281 78 297 74 307 L66 301 C60 285 58 267 60 253 Z",
    "M80 263 C88 263 94 261 98 258 C96 278 92 296 88 305 L76 307 C80 293 82 279 80 263 Z",
  ],
  mollets: [
    "M66 316 C60 334 62 354 70 368 C74 370 78 366 78 358 C78 342 76 328 74 318 Z",
    "M76 318 C84 326 90 342 88 360 C86 370 80 372 78 366 C80 350 79 334 76 318 Z",
    "M68 370 C70 380 74 388 76 392 L82 392 C84 384 86 376 86 368 C82 376 74 376 68 370 Z",
  ],
};

/** Ce qui n'est pas du muscle (mains, genoux, pieds) : en simple contour. */
export const OUTLINE: Record<View, string[]> = {
  face: [
    "M27 228 C21 236 19 250 21 262 C25 271 34 273 40 266 C44 256 45 241 45 230 Z",
    "M70 302 C72 314 86 316 90 302 C86 298 74 298 70 302 Z",
    "M70 392 C66 404 66 414 72 422 L92 422 C94 414 88 404 84 392 Z",
  ],
  dos: [
    "M27 228 C21 236 19 250 21 262 C25 271 34 273 40 266 C44 256 45 241 45 230 Z",
    "M68 304 C72 310 86 312 90 304 C86 314 74 314 68 304 Z",
    "M70 392 C66 404 68 416 74 422 L90 422 C92 414 88 404 84 392 Z",
  ],
};

/** La tête, centrée : dessinée une seule fois, sans miroir. */
export const HEAD = { cx: 100, cy: 34, rx: 17, ry: 23 };

export function musclesOf(view: View): Partial<Record<MuscleKey, string[]>> {
  return view === "face" ? FRONT : BACK;
}

/**
 * La vue qui montre le mieux un exercice : celle où l'on voit le plus de ses
 * muscles. À égalité, la face.
 */
export function bestView(muscles: MuscleKey[]): View {
  const seen = (view: View) => muscles.filter((key) => musclesOf(view)[key]).length;
  return seen("dos") > seen("face") ? "dos" : "face";
}
