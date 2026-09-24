import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vercel sets these at build time; exposing them lets the page show which commit is live.
  envPrefix: ["VITE_", "VERCEL_GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_REF"],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
