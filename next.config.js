/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Tree-shake heavy barrel imports so routes only ship what they use.
  // recharts is large; this keeps it out of shared chunks and trims the
  // analytics bundle considerably.
  experimental: {
    optimizePackageImports: ["recharts"],
  },
};

module.exports = nextConfig;
