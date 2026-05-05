// ============================================================
// サーバー専用の環境変数定義
// ============================================================
// このファイルは apps/server や packages/auth など、サーバーで動くコードから使います。
// 秘密鍵や DB 接続文字列を含むため、ブラウザで動く web コンポーネントからは import しません。
//
// createEnv は起動時に環境変数を検証します。足りない値があれば早めに
// エラーにして、実行中に undefined で落ちるのを防ぎます。
// ============================================================

import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // SQLite/libSQL の接続先。ローカルでは file:local.db のような値を使う。
    DATABASE_URL: z.string().min(1),
    // Better Auth が Cookie やトークンを署名するための秘密文字列。
    BETTER_AUTH_SECRET: z.string().min(32),
    // 認証 API の基準 URL。ローカルでは http://localhost:3002。
    BETTER_AUTH_URL: z.url(),
    // ブラウザ側アプリの origin。CORS と認証 Cookie の許可に使う。
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Google OAuth は任意機能。未設定でも開発を始められるよう placeholder を持つ。
    GOOGLE_CLIENT_ID: z.string().min(1).default("placeholder"),
    GOOGLE_CLIENT_SECRET: z.string().min(1).default("placeholder"),
    // S3 互換ストレージを使う場合だけ設定。未設定ならローカル保存に fallback する。
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: z.string().default("family-times"),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    // Push 通知用の VAPID キー。未設定なら Push 通知は無効。
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().default("mailto:admin@family-times.app"),
    MAPBOX_TOKEN: z.string().optional(),
  },
  // process.env から値を読む。Bun/Node のサーバー側で使う形。
  runtimeEnv: process.env,
  // 空文字を undefined 扱いにして、未設定と同じように扱う。
  emptyStringAsUndefined: true,
});
