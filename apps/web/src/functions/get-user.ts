// ============================================================
// TanStack Start - サーバー関数（Server Function）
// ============================================================
// createServerFn() で定義された関数は TanStack Start の「サーバー関数」です。
//
// ■ サーバー関数とは？
//   SSR（サーバーサイドレンダリング）時はサーバー上で直接実行され、
//   クライアントサイドではHTTPリクエスト経由でサーバーに問い合わせます。
//
//   これにより：
//   - SSR時: DBやAPIに直接アクセスでき、高速
//   - CSR時: 自動でHTTPリクエストに変換される
//   → 書くコードは同じで、実行環境に応じて動作が切り替わる
//
// ■ middleware:
//   サーバー関数にミドルウェアを適用できる。
//   authMiddleware はリクエストヘッダーからセッションを取得し、
//   context.session としてハンドラーに渡す。
// ============================================================

import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/middleware/auth";

// getUser: 現在ログイン中のユーザーのセッション情報を取得するサーバー関数
export const getUser = createServerFn({ method: "GET" })
  .middleware([authMiddleware]) // 認証ミドルウェアを適用
  .handler(async ({ context }) => {
    // context.session は authMiddleware で取得されたセッション情報
    // 未ログインの場合は null / undefined
    return context.session;
  });
