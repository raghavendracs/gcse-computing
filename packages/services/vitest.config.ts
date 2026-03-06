import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    server: {
      deps: {
        inline: ["mongoose", "@gcse/database"],
      },
    },
  },
  resolve: {
    alias: {
      mongoose: path.resolve(
        __dirname,
        "../../packages/database/node_modules/mongoose",
      ),
    },
  },
});
