import type { MetadataRoute } from "next"
import gamesData from "@/data/games.json"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: gamesData.site.name,
    short_name: "EditMySave",
    description: gamesData.site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
