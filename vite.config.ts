import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        present: "present.html",
        join: "join.html"
      }
    }
  }
});
