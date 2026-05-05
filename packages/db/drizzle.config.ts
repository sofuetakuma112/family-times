import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// Drizzle Kit はマイグレーション作成・実行に使う CLI ツールです。
// server 側の .env に DATABASE_URL があるため、ここで明示的に読み込みます。
dotenv.config({
  path: "../../apps/server/.env",
});

export default defineConfig({
  // TypeScript で書いたテーブル定義の場所です。
  schema: "./src/schema",
  // 生成されたマイグレーション SQL の出力先です。
  out: "./src/migrations",
  // Turso/libSQL は SQLite 互換なので dialect は "turso" を指定します。
  dialect: "turso",
  dbCredentials: {
    // ローカルで DATABASE_URL が未設定でも作業できるよう、local.db にフォールバックします。
    url: process.env.DATABASE_URL || "file:../../local.db",
  },
});
