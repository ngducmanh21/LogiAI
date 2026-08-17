const backendUrl = (
  process.env.SOATAI_API_URL ||
  process.env.NEXT_PUBLIC_SOATAI_API_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: new URL(".", import.meta.url).pathname,
  async rewrites() {
    return [
      {
        source: "/api/document-sessions/:path*",
        destination: `${backendUrl}/api/document-sessions/:path*`,
      },
      {
        source: "/api/legal/:path*",
        destination: `${backendUrl}/api/legal/:path*`,
      },
    ];
  },
};

export default nextConfig;
