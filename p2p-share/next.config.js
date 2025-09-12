/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Fix for socket.io-client in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      fs: false,
    };
    return config;
  },
}

module.exports = nextConfig