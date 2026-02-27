import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  serverExternalPackages: [
    '@huggingface/transformers',
    'onnxruntime-node'
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'leetcode.com',
        pathname: '/static/**',
      },
      {
        protocol: 'https',
        hostname: 'assets.leetcode.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/**',
      },
      {
        // Cloudflare Worker proxy (for client-side storage URLs)
        protocol: 'https',
        hostname: '*.workers.dev',
        pathname: '/storage/v1/**',
      },
    ],
  },

  // Required for ONNX Runtime's threaded WASM (SharedArrayBuffer).
  // Scoped to /vad/ assets only to avoid breaking OAuth popups or 3P scripts.
  async headers() {
    return [
      {
        source: "/vad/:path*",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
      {
        source: "/interview",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/interview/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/assess/:path*",
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

