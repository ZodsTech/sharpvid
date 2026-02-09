import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",

    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false
      }
    },

    allowedHosts: [
      "f3b91ffe-1f52-4689-863b-502036474519-00-qwxb21kkmao6.worf.replit.dev"
    ]
  }
});