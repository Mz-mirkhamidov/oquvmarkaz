import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Qalqon — davomat va dalil tizimi",
    short_name: "Qalqon",
    description: "Nodavlat bog'chalar uchun mustaqil davomat va dalil tizimi.",
    start_url: "/davomat",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#0f766e",
    orientation: "portrait",
    lang: "uz",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
