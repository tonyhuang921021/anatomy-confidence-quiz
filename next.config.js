/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/api/owner/parasitology-review": [
        "./data/owner/parasitology_board_review_interactive_v2.html"
      ],
      "/api/owner/bacteria-review": [
        "./data/owner/bacteria_board_review_interactive_v2.html"
      ],
      "/api/owner/virus-review": [
        "./data/owner/virus_board_review_interactive_v1.html"
      ]
    }
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
