import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Serves the Vercel functions in /api during `vite dev`, using keys from .env.local.
function localApi(): Plugin {
  return {
    name: "sotto-local-api",
    apply: "serve",
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ""));
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const name = /^\/api\/([a-z-]+)$/.exec(url.pathname)?.[1];
        if (!name || !existsSync(resolve("api", `${name}.ts`))) return next();

        try {
          const module = (await server.ssrLoadModule(`/api/${name}.ts`)) as Record<string, unknown>;
          const handler = module[req.method ?? "GET"];
          if (typeof handler !== "function") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === "string") headers.set(key, value);
          }
          const hasBody = req.method !== "GET" && req.method !== "HEAD";
          const request = new Request(url, {
            method: req.method,
            headers,
            body: hasBody ? Buffer.concat(chunks) : undefined,
          });
          const response = (await handler(request)) as Response;
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [localApi()],
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
