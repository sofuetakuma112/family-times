import { defineConfig } from "tsdown";

// server アプリをビルドするための tsdown 設定です。
// src/index.ts を ESM 形式で dist に出力し、ローカル workspace パッケージは同梱します。
export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  noExternal: [/@family-times-new\/.*/],
});
