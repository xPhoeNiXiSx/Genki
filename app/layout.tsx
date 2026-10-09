import type { Metadata, Viewport } from "next";
import { DM_Mono, Dela_Gothic_One, Zen_Kaku_Gothic_New } from "next/font/google";

import "./globals.css";

/**
 * Trois familles : Dela Gothic One pour les titres et les grands chiffres
 * (elle porte aussi les katakana), Zen Kaku Gothic pour le texte, DM Mono
 * pour les numéros de dossard, les dates et les durées.
 */
const display = Dela_Gothic_One({ weight: "400", subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Zen_Kaku_Gothic_New({ weight: ["500", "700", "900"], subsets: ["latin"], variable: "--font-body", display: "swap" });
const mono = DM_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Genki",
  description: "Programmes d'entraînement, séances et métronome.",
  // Ce que iOS lit quand l'application est posée sur l'écran d'accueil.
  appleWebApp: {
    capable: true,
    title: "Genki",
    statusBarStyle: "default",
  },
  // Les versions d'iOS antérieures à 16.4 ne lisent que la variante préfixée :
  // sans elle, le raccourci rouvre le site dans Safari.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3f2eb",
  // Laisse la page occuper toute la dalle ; les encoches sont absorbées par
  // les `env(safe-area-inset-*)` du CSS.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        {/* Écran de démarrage : l'ensō 元気 sur fond encre, qui s'efface de
            lui-même. En CSS seul, sans script ; posé dans la mise en page
            commune, il ne se joue qu'à l'ouverture, pas à chaque navigation. */}
        <div className="splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/genki-enso.svg" alt="" width={168} height={168} />
        </div>
        {children}
      </body>
    </html>
  );
}
