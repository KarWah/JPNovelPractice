import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "青春豚野郎 SRS",
    short_name: "SeibuSRS",
    description: "Spaced repetition vocabulary trainer for Seishun Buta Yarou",
    start_url: "/",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#4f46e5",
    orientation: "portrait",
    categories: ["education", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Study now",
        url: "/study",
        description: "Start a study session",
      },
      {
        name: "Browse vocab",
        url: "/vocab",
        description: "Browse all vocabulary",
      },
    ],
  };
}
