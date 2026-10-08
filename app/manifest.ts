import type { MetadataRoute } from "next";

/**
 * Manifeste d'application. `display: standalone` est ce qui fait disparaître
 * la barre d'adresse une fois l'application posée sur l'écran d'accueil.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Genki",
    short_name: "Genki",
    description: "Programmes d'entraînement, séances et métronome.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f2eb",
    theme_color: "#f3f2eb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
