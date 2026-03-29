import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const alias = [
  {
    find: "@tasks-dispatcher/core/contracts",
    replacement: resolve(__dirname, "../../packages/core/src/contracts/index.ts")
  },
  {
    find: "@tasks-dispatcher/workspace-runtime/client",
    replacement: resolve(
      __dirname,
      "../../packages/workspace-runtime/src/client/index.ts"
    )
  },
  {
    find: "@tasks-dispatcher/core",
    replacement: resolve(__dirname, "../../packages/core/src/index.ts")
  },
  {
    find: "@tasks-dispatcher/workspace-runtime",
    replacement: resolve(__dirname, "../../packages/workspace-runtime/src/index.ts")
  }
];

export default defineConfig({
  main: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "src/main/main.ts")
        }
      }
    }
  },
  preload: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          taskBoardApi: resolve(__dirname, "src/preload/taskBoardApi.ts")
        },
        output: {
          entryFileNames: "[name].js",
          format: "cjs"
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    resolve: { alias },
    plugins: [react()]
  }
});
