import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const scalaJsPath =
  process.env.NODE_ENV === "production"
    ? "../js/target/scala-3.5.2/contrapunctus-opt/main.js"
    : "../js/target/scala-3.5.2/contrapunctus-fastopt/main.js";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      contrapunctus: path.resolve(__dirname, scalaJsPath),
    },
  },
});
