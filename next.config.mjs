/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdf-parse reads test files via require() at init time — keep it out of webpack
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
