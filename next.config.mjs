/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      // Minecraft Dungeons 2 launched at /dungeons-2; keep old links working.
      { source: "/dungeons-2", destination: "/minecraft-dungeons-2", permanent: true },
    ]
  },
}

export default nextConfig
