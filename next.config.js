/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    webpackBuildWorker: false
  },
  webpack(config, { dev }) {
    if (!dev) {
      config.cache = false;
    }
    return config;
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
      },
      {
        source: "/:path*",
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
