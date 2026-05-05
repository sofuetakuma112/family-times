// ============================================================
// oRPC クライアント + TanStack Query の統合
// ============================================================
// このファイルはフロントエンドからバックエンドAPIを呼び出すための
// クライアントを設定します。
//
// ■ oRPC クライアントの仕組み:
//   サーバーの AppRouter 型をインポートし、型安全なAPI呼び出しを実現。
//   client.servers.create({ name: "家族" }) のように、
//   サーバーの関数をローカル関数のように呼び出せます。
//
// ■ TanStack Query（旧 React Query）とは？
//   サーバーデータのフェッチ・キャッシュ・同期を管理するライブラリです。
//   - useQuery: データの取得 + 自動キャッシュ + 再フェッチ
//   - useMutation: データの更新（POST/PUT/DELETE相当）
//   - staleTime: キャッシュの有効期間（この間は再フェッチしない）
//   - invalidateQueries: キャッシュを無効化して再フェッチを強制
//
// ■ RPCLink:
//   oRPC のプロシージャ呼び出しを HTTP リクエストに変換する層。
//   内部的には fetch() で /rpc エンドポイントにリクエストを送る。
//
// ■ orpc（TanStack Query Utils）:
//   oRPC と TanStack Query を統合するユーティリティ。
//   orpc.servers.list.queryOptions() のように書くと、
//   useQuery() に渡せるオプション（queryKey, queryFn）を自動生成する。
// ============================================================

import type { AppRouter } from "@family-times-new/api/routers/index";
import { env } from "@family-times-new/env/web";
import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * TanStack Query の QueryClient を作成する関数
 *
 * QueryClient はキャッシュの管理やクエリの設定を一元管理するオブジェクト。
 * SSR時はリクエストごとに新しいインスタンスを作成（ユーザー間のデータ漏洩を防止）。
 */
export function createQueryClient() {
  return new QueryClient({
    // queryCache: クエリでエラーが発生した時のグローバルハンドラー
    queryCache: new QueryCache({
      onError: (error, query) => {
        // typeof window !== "undefined": ブラウザ環境でのみトースト表示
        //（SSRサーバーでは window が存在しない）
        if (typeof window !== "undefined") {
          toast.error(`Error: ${error.message}`, {
            action: {
              label: "retry",
              onClick: query.invalidate, // リトライボタンでキャッシュ無効化→再フェッチ
            },
          });
        }
      },
    }),
    defaultOptions: {
      queries: {
        // staleTime: 30秒間はキャッシュを新鮮（stale でない）とみなす
        // この間は同じクエリを再実行してもネットワークリクエストは発生しない
        staleTime: 30_000,
      },
    },
  });
}

// ─── クライアントサイドのシングルトン ────────────────────────
// ブラウザでは1つの QueryClient を共有（タブ内で1つ）
// SSR では毎回新しいインスタンスを作る（ユーザー間でキャッシュが混ざらないように）
let _queryClient: QueryClient | undefined;
export const queryClient =
  typeof window !== "undefined"
    ? (_queryClient ??= createQueryClient()) // ??= は null/undefined の時だけ代入
    : createQueryClient();

// ─── oRPC 通信リンクの作成 ──────────────────────────────────
// RPCLink: oRPC のプロシージャ呼び出しを HTTP リクエストに変換する
const link = new RPCLink({
  url: `${env.VITE_SERVER_URL}/rpc`, // APIサーバーのRPCエンドポイント
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include", // Cookie を含める（認証に必要）
    });
  },
});

// ─── oRPC クライアントの作成 ─────────────────────────────────
// createORPCClient<RouterClient<AppRouter>> で型安全なクライアントを作成
// 直接 API を呼び出す場合に使用（例: client.servers.create({...})）
export const client = createORPCClient<RouterClient<AppRouter>>(link);

// ─── TanStack Query 統合 ────────────────────────────────────
// createTanstackQueryUtils で oRPC + TanStack Query のユーティリティを作成
// useQuery(orpc.servers.list.queryOptions()) のように使う
export const orpc = createTanstackQueryUtils(client);
