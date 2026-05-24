import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "國考刷題測驗",
    short_name: "國考刷題",
    description: "用答題結果、信心程度與完成度，找出你的一階醫師國考弱點。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f3ea",
    theme_color: "#f6f3ea",
    lang: "zh-Hant",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/apple-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
