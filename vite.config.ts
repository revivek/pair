import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { proxyMiddleware } from "./server/proxy";

export default defineConfig(({ mode }) => {
  // Load .env into process.env so server middleware can access API keys
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 3000,
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "api-proxy",
        configureServer(server) {
          server.middlewares.use(proxyMiddleware);
        },
      },
    ],
  };
});
