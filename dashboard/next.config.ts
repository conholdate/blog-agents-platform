import type { NextConfig } from "next";

// Stamped once per Vercel build so the sidebar version always matches what's live;
// left empty locally, where the sidebar shows "dev" instead.
const onVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  env: {
    BUILD_TIME: onVercel ? new Date().toISOString() : "",
    BUILD_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
    BUILD_REPO_URL:
      process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
        ? `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
        : "",
  },
};

export default nextConfig;
