import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Keep the installed-app identity stable while updating the visible brand.
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
      { src: "/branding/vanta-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/branding/vanta-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}