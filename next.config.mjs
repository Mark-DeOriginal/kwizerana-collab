/** @type {import('next').NextConfig} */
const nextConfig = {
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
  },
  webpack: (config) => {
    // Optional dependencies pulled in by wallet-connect libraries that are
    // never used in a web bundle (React Native storage, pino pretty printer).
    config.resolve.alias = {
      ...config.resolve.alias,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false
    };
    return config;
  }
};

export default nextConfig;
