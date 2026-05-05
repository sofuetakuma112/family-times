// ============================================================
// TanStack Start ミドルウェア - 認証
// ============================================================
// TanStack Start のサーバー関数用ミドルウェアです。
//
// ■ createMiddleware().server():
//   サーバーサイドでのみ実行されるミドルウェアを定義。
//   リクエストヘッダーから Better-Auth のセッション情報を取得し、
//   後続のハンドラーにコンテキストとして渡します。
//
// ■ authClient.getSession():
//   Better-Auth の React クライアントを使ってセッションを取得。
//   サーバーサイドではリクエストヘッダー（Cookie含む）を転送し、
//   Better-Auth のサーバーにセッションの有効性を問い合わせます。
// ============================================================

import { createMiddleware } from "@tanstack/react-start";

import { authClient } from "@/lib/auth-client";

export const authMiddleware = createMiddleware().server(async ({ next, request }) => {
  // Better-Auth クライアントでセッションを取得
  // fetchOptions.headers にリクエストヘッダーを渡す（Cookie の転送が必要）
  const session = await authClient.getSession({
    fetchOptions: {
      headers: request.headers,
      throw: true, // セッション取得に失敗した場合は例外をスロー
    },
  });
  // next() で次のミドルウェアまたはハンドラーに進む
  // context にセッション情報を追加
  return next({
    context: { session },
  });
});
