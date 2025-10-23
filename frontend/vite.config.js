import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true, // Fail if port is already in use instead of incrementing
    host: true,
  },
});
