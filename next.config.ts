import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // transformers.js / onnxruntime run only in the browser (Extract panel) — keep
  // them out of the server bundle so the build doesn't try to pull node bindings.
  serverExternalPackages: ['@huggingface/transformers'],
};

export default nextConfig;
