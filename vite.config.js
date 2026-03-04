import { defineConfig } from "vite";

export default defineConfig({
    base: "/sharpvid",
  server: {
      host: "0.0.0.0",
          port: 5173,
              strictPort: true,
                  proxy: {
                        "/api": {
                                target: "http://localhost:3000",
                                        changeOrigin: true,
                                                secure: false
                                                      }
                                                          }
                                                            }
                                                            });