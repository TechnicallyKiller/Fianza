/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // Docs moved to the separately-hosted Mintlify site. Redirect the old
    // internal route (and any old sub-paths / bookmarks) there. 307 (temporary)
    // to avoid browsers hard-caching it while things are still settling.
    return [
      {
        source: "/docs",
        destination: "https://docs.0xtrustline.online",
        permanent: false,
      },
      {
        source: "/docs/:path*",
        destination: "https://docs.0xtrustline.online",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
