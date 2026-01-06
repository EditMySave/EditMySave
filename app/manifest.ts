import { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EditMySave - Free Online Game Save Editor",
    short_name: "EditMySave",
    description:
      "Edit your game save files directly in your browser. Free online save editor for multiple games. No downloads required.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon-dark-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
    categories: ["games", "utilities"],
    orientation: "portrait-primary",
  }
}
