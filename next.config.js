/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    API_URL: process.env.API_URL || 'http://localhost:3001',
  },
  // Use 'standalone' for Docker/server deployment, 'export' for Electron
  output: process.env.BUILD_TARGET === 'electron' ? 'export' : 'standalone',
  trailingSlash: process.env.BUILD_TARGET === 'electron',
  images: {
    unoptimized: process.env.BUILD_TARGET === 'electron',
  },
  // Asset prefix only for Electron builds
  assetPrefix: process.env.BUILD_TARGET === 'electron' ? './' : '',
}

module.exports = nextConfig