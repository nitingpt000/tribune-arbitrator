import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@tribune/ui', '@tribune/types'],
  eslint: {
    // Linting is handled by Turbo (`pnpm lint`); skip the bundled next lint check
    // so flat-config setups don't print the "plugin not detected" warning.
    ignoreDuringBuilds: true,
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
