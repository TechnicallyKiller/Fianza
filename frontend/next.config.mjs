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
      // Legacy blue-theme pages (coming-soon, preview) predate the shipped
      // dashboards and clash with the current design system — redirect to home
      // so a stray link never shows a stale "almost here" page.
      { source: "/coming-soon", destination: "/", permanent: false },
      { source: "/preview", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
