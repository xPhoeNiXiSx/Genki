import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Genki",
  description: "Programmes d'entraînement, séances et métronome.",
  // Ce que iOS lit quand l'application est posée sur l'écran d'accueil.
  appleWebApp: {
    capable: true,
    title: "Genki",
    statusBarStyle: "black-translucent",
  },
  // Les versions d'iOS antérieures à 16.4 ne lisent que la variante préfixée :
  // sans elle, le raccourci rouvre le site dans Safari.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111214",
  // Laisse la page occuper toute la dalle ; les encoches sont absorbées par
  // les `env(safe-area-inset-*)` du CSS.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
