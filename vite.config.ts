import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        present: resolve(__dirname, "present.html"),
        join: resolve(__dirname, "join.html"),
      },
    },
  },
});
