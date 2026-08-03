// app/manifest.ts — necessario per l'installabilità ("aggiungi a schermata Home"),
// rilevante per il tuo caso d'uso: un'icona sul telefono apribile anche offline
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Avvistamenti Fauna Trentino",
    short_name: "Avvistamenti",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16a34a",
    icons: [
      { src: "/file.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/file.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  };
}