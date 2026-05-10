/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Đảm bảo NFT đóng gói bundle Express (copy vào .next/server sau build).
    outputFileTracingIncludes: {
      '/*': ['./express-bundle.cjs'],
    },
  },
};

module.exports = nextConfig;

