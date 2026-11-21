import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "VANTA — Create. Connect. Live.",
    short_name: "VANTA",
    description:
      "Premium social streaming, creator, and discovery platform. Discover people, follow creators, chat, join live streams, and build communities.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone"],
    orientation: "portrait",
    background_color: "#02040D",
    theme_color: "#02040D",
    icons: [
      { src: "/branding/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/branding/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/branding/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
