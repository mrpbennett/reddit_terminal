/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/subreddits',
        destination: '/api/subreddits', // Points to our local API handler
      },
    ]
  },
}

module.exports = nextConfig
