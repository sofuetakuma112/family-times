// ============================================================
// Better Auth 設定
// ============================================================
// このファイルは「ログイン・ログアウト・セッション管理」の中心です。
//
// ■ Better Auth とは？
//   メール/パスワードログイン、Google OAuth、Cookie セッションなどを
//   まとめて扱う認証ライブラリです。
//
// ■ Drizzle adapter:
//   Better Auth が使う user/session/account テーブルを、
//   このアプリの SQLite + Drizzle DB に保存するための接続口です。
//
// ■ このファイルがサーバー専用である理由:
//   BETTER_AUTH_SECRET や Google client secret など、ブラウザに出しては
//   いけない秘密情報を読むため、web 側から直接 import しません。
// ============================================================

import { createDb } from "@family-times-new/db";
import * as schema from "@family-times-new/db/schema/auth";
import { env } from "@family-times-new/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth() {
  // Better Auth がユーザー・セッション情報を保存する DB 接続。
  const db = createDb();

  return betterAuth({
    // Drizzle の schema/auth.ts に定義した認証テーブルを Better Auth に渡す。
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: schema,
    }),
    // フロントエンドからの認証リクエストを許可する origin。
    trustedOrigins: [env.CORS_ORIGIN],
    // メールアドレス + パスワードのログインを有効化。
    emailAndPassword: {
      enabled: true,
    },
    // Google OAuth。環境変数が placeholder のままだと本番ログインには使えない。
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // Cookie はログイン状態をブラウザに保存する仕組み。
    // 本番では HTTPS 前提で secure + sameSite none にする。
    advanced: {
      defaultCookieAttributes: {
        sameSite: env.NODE_ENV === "production" ? "none" : "lax",
        secure: env.NODE_ENV === "production",
        httpOnly: true,
      },
    },
    // Better Auth の標準 user に、このアプリ用のプロフィール画像情報を追加。
    user: {
      additionalFields: {
        photoId: {
          type: "string",
          required: false,
          input: true,
        },
        photoExtension: {
          type: "string",
          required: false,
          input: true,
        },
      },
    },
    plugins: [],
  });
}

export const auth = createAuth();
