// ============================================================
// oRPC Context 作成
// ============================================================
// Context は、API の各 procedure に毎回渡される共有データです。
// ここでは Hono のリクエストから Cookie を読み、Better Auth の session を取得します。
//
// ブラウザが /rpc/... を呼ぶ
// → Hono がリクエストを受ける
// → createContext が session を取得
// → protectedProcedure が session の有無を確認
// という順番で認証がつながります。
// ============================================================

import { auth } from "@family-times-new/auth";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  // Hono の Context。HTTP リクエスト、headers、Cookie などへアクセスできる。
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  // Better Auth は Cookie を headers から読み取り、ログイン中なら session を返す。
  const session = await auth.api.getSession({
    headers: context.req.raw.headers,
  });
  return {
    // 将来 auth helper を追加する余地。現状は session を直接使う。
    auth: null,
    session,
  };
}

// createContext の戻り値から Context 型を作る。
// API 側ではこの型により context.session の型補完が効く。
export type Context = Awaited<ReturnType<typeof createContext>>;
