// ============================================================
// Vite 設定ファイル - フロントエンドのビルドツール
// ============================================================
// Vite は高速なフロントエンドビルドツール / 開発サーバーです。
//
// ■ プラグイン:
//   - tailwindcss(): TailwindCSS v4 のViteプラグイン
//   - tanstackStart(): TanStack Start（SSR対応フレームワーク）のプラグイン
//     ファイルベースルーティングやサーバー関数の変換を行う
//   - viteReact(): React の JSX 変換やHMR（Hot Module Replacement）を提供
//
// ■ tsconfigPaths:
//   tsconfig.json の paths 設定（例: "@/*" → "src/*"）を
//   Vite のモジュール解決でも使えるようにする。
//   これにより import { xxx } from "@/utils/orpc" のような
//   エイリアスインポートが動作する。
// ============================================================

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3001, // フロントエンドの開発サーバーポート
  },
  resolve: {
    tsconfigPaths: true, // tsconfig.json の paths エイリアスを有効化
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
