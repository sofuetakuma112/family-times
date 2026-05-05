// ============================================================
// TanStack Router - トップページ（"/" ルート）
// ============================================================
// ファイルベースルーティングにより、このファイルが "/" パスに対応します。
//
// ■ createFileRoute("/"):
//   このファイルのパスから自動でルートを作成。
//   "/" はアプリのトップページ。
//
// ■ beforeLoad:
//   ルートが描画される前に実行される非同期関数。
//   ここで認証チェックを行い、未ログインなら /login にリダイレクト。
//   これが「ルートガード」と呼ばれるパターンです。
//
// ■ getUser():
//   TanStack Start のサーバー関数。SSR時はサーバーで実行され、
//   Cookie からセッション情報を取得します。
//   クライアント側では HTTP リクエストでサーバーに問い合わせます。
// ============================================================

import { createFileRoute, redirect } from "@tanstack/react-router";

import { getUser } from "@/functions/get-user";
import AppShell from "@/components/app-shell";

export const Route = createFileRoute("/")({
  // ルートガード: ページ表示前に認証チェック
  beforeLoad: async () => {
    const session = await getUser();
    if (!session) {
      // throw redirect: TanStack Router のリダイレクト方法
      // 通常の return ではなく throw でリダイレクトを「中断」として扱う
      throw redirect({ to: "/login" });
    }
    // return したオブジェクトはルートコンテキストに追加される
    return { session };
  },
  component: AppShellRoute,
});

function AppShellRoute() {
  // Route.useRouteContext(): beforeLoad で return した値を取得
  const { session } = Route.useRouteContext();
  return <AppShell session={session} />;
}
