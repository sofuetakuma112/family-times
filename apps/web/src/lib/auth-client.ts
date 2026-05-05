// ============================================================
// Better-Auth - フロントエンドクライアント
// ============================================================
// Better-Auth の React 用クライアントを作成します。
//
// ■ createAuthClient():
//   フロントエンドから Better-Auth のAPI（サインイン、サインアップ等）を
//   呼び出すためのクライアントを作成します。
//
//   提供される機能:
//   - authClient.signIn.email({ email, password })  → メールでログイン
//   - authClient.signIn.social({ provider: "google" }) → Google ログイン
//   - authClient.signOut()                           → ログアウト
//   - authClient.getSession()                        → セッション取得
//   - authClient.useSession()                        → React Hook でセッション取得
//
// ■ baseURL:
//   Better-Auth のAPIサーバーのURL。
//   /api/auth/* エンドポイントにリクエストを送信します。
// ============================================================

import { env } from "@family-times-new/env/web";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL, // APIサーバーのURL（例: "http://localhost:3002"）
});
