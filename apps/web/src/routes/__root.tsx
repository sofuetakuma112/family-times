// ============================================================
// TanStack Router - ルートレイアウト（__root.tsx）
// ============================================================
// __root.tsx は全ページに共通する最上位のレイアウトです。
// HTML の <html>, <head>, <body> タグを定義し、
// 全ルートの「親」として機能します。
//
// ■ createRootRouteWithContext<RouterAppContext>():
//   コンテキスト（orpc, queryClient）を型安全に全ルートに渡す。
//   子ルートでは Route.useRouteContext() でアクセスできる。
//
// ■ <Outlet />:
//   現在のルートに対応するコンポーネントがここに描画される。
//   例: /login → LoginRoute が <Outlet /> の位置に表示される
//
// ■ head():
//   <head> タグの内容（meta, link 等）を定義する。
//   TanStack Start の SSR でサーバーサイドで <head> が生成される。
// ============================================================

import { Toaster } from "@family-times-new/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import type { orpc } from "@/utils/orpc";

import appCss from "../index.css?url";

// 全ルートで共有するコンテキストの型定義
export interface RouterAppContext {
  orpc: typeof orpc;        // oRPC のユーティリティ（API呼び出し用）
  queryClient: QueryClient;  // TanStack Query のクライアント
}

// ルートルートの作成（全ページの親）
export const Route = createRootRouteWithContext<RouterAppContext>()({
  // <head> タグの内容を定義
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { title: "Family Times" },
      { name: "theme-color", content: "#4285F4" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootDocument,
});

/**
 * ルートドキュメントコンポーネント
 *
 * - <HeadContent />: head() で定義した meta/link を描画
 * - <Outlet />: 子ルートのコンポーネントを描画（React Router の考え方）
 * - <Toaster />: トースト通知の表示コンテナ（sonner ライブラリ）
 * - <ReactQueryDevtools />: TanStack Query のデバッグツール（開発時のみ表示）
 * - <Scripts />: TanStack Start が生成するクライアントサイドJSを読み込む
 */
function RootDocument() {
  return (
    <html lang="ja" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        <Outlet />
        <Toaster richColors position="top-right" />
        <QueryDevtoolsGate />
        <Scripts />
      </body>
    </html>
  );
}

function QueryDevtoolsGate() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(
      import.meta.env.DEV &&
        window.localStorage.getItem("family-times:query-devtools") === "1",
    );
  }, []);

  if (!enabled) return null;

  return <ReactQueryDevtools position="right" buttonPosition="top-right" />;
}
