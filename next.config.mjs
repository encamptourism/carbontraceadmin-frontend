/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Proxy API calls to the backend so the browser never hits CORS.
  // /auth/* maps to the backend's session login/logout (our own /login is the page).
  async rewrites() {
    const api = process.env.API_URL || "https://admin.carbontrace.in";
    return [
      { source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` },
      { source: "/auth/:path(login|logout)", destination: `${api}/:path` },
      // The one endpoint outside /api/v1 (ASA metadata); /backend/ keeps it clear of our /wallet page.
      { source: "/backend/wallet/:path*", destination: `${api}/wallet/:path*` },
    ];
  },
};

export default nextConfig;
