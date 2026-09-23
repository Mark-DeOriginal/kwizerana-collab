/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Persistent Turbopack caching grew beyond 1 GB and became dramatically
    // slower than recompiling on this Windows filesystem.
    turbopackFileSystemCacheForDev: false
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com"
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com"
      }
    ]
  }
};

export default nextConfig;
