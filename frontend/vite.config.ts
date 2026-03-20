import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      contrapunctus: path.resolve(
        __dirname,
        "../js/target/scala-3.5.2/contrapunctus-fastopt/main.js"
      ),
    },
  },
});
