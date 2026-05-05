// ============================================================
// TanStack Router - ルーターの作成
// ============================================================
// TanStack Start は React のフルスタックフレームワークで、
// TanStack Router をベースにしています。
//
// ■ TanStack Router の特徴:
//   - ファイルベースルーティング: src/routes/ 配下のファイルが自動でルートになる
//     例: src/routes/login.tsx → /login
//         src/routes/invite/$inviteCode.tsx → /invite/:inviteCode
//   - 型安全: ルートのパラメータや検索パラメータに型がつく
//   - SSR対応: サーバーサイドレンダリングをサポート
//
// ■ routeTree.gen.ts:
//   TanStack Router の CLI が src/routes/ を解析して自動生成するファイル。
//   ルートの定義やパスの型情報を含む。手動で編集しない。
//
// ■ context:
//   ルーターに渡す共有データ。全ルートから useRouteContext() でアクセスできる。
//   ここでは orpc（API呼び出し）と queryClient（TanStack Query）を渡している。
// ============================================================

import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import "./index.css";
import Loader from "./components/loader";
import { routeTree } from "./routeTree.gen"; // 自動生成されたルートツリー
import { orpc, createQueryClient } from "./utils/orpc";

export const getRouter = () => {
  // SSR リクエストごとに新しい QueryClient を作成
  // （ユーザーAのデータがユーザーBに見えるのを防止）
  const queryClient = createQueryClient();

  const router = createTanStackRouter({
    routeTree,                     // 自動生成されたルートツリー
    scrollRestoration: true,       // ページ遷移時にスクロール位置を復元
    defaultPreloadStaleTime: 0,    // プリロード時は常に最新データを取得
    context: { orpc, queryClient }, // 全ルートで使える共有データ
    defaultPendingComponent: () => <Loader />,       // ルート読み込み中の表示
    defaultNotFoundComponent: () => <div>Not Found</div>, // 404ページ
  });

  // SSR と TanStack Query の統合
  // サーバーで取得したデータをクライアントに引き継ぐ設定
  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};

// ─── TypeScript の型拡張 ────────────────────────────────────
// TanStack Router にこのアプリのルーター型を登録する。
// これにより Link コンポーネントや useNavigate() で型補完が効くようになる。
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
