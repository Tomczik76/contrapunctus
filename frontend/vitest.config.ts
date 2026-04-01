import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      contrapunctus: path.resolve(__dirname, "../js/target/scala-3.5.2/contrapunctus-fastopt/main.js"),
    },
  },
  test: {
    environment: "node",
  },
});
