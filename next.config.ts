import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
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
    ];
  },
};

export default nextConfig;

