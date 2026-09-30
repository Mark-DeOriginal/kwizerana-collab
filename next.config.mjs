/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      "@react-native-async-storage/async-storage": "./lib/web3/async-storage-web-shim.ts"
    }
  },
  webpack(config) {
    config.resolve.alias["@react-native-async-storage/async-storage"] = false;
    return config;
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
