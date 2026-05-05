// ============================================================
// oRPC procedure の共通定義
// ============================================================
// このファイルは API ルーター全体の土台です。
//
// ■ procedure とは？
//   oRPC で API の1つの処理を表す単位です。
//   例: servers.list, messages.send, users.updateProfile など。
//
// ■ publicProcedure / protectedProcedure:
//   publicProcedure は未ログインでも呼べる処理用。
//   protectedProcedure は requireAuth middleware を通すため、ログイン必須です。
//
// ■ Context:
//   context.ts で作った「リクエストごとの共有情報」です。
//   ここでは Better Auth の session を見て、ログイン済みか判定します。
// ============================================================

import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

// oRPC に「この API では Context 型を使う」と教える。
export const o = os.$context<Context>();

// 誰でも呼べる API の基礎。必要に応じて .input() や .handler() をつなげる。
export const publicProcedure = o;

// protectedProcedure の前段で実行される認証チェック。
const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  // next に session を渡すことで、handler 内では context.session.user を安全に読める。
  return next({
    context: {
      session: context.session,
    },
  });
});

// ログイン必須 API は publicProcedure.use(requireAuth) から作る。
export const protectedProcedure = publicProcedure.use(requireAuth);
