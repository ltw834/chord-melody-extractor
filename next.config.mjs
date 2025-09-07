/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.NODE_ENV === 'production' ? '/chord-melody-extractor' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/chord-melody-extractor/' : '',
  images: {
    unoptimized: true,
  },
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config, { isServer }) => {
    // Handle WASM files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // Ignore canvas for server-side rendering
    if (isServer) {
      config.externals.push('canvas');
    }

    return config;
  },
};

export default nextConfig;