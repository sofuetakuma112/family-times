import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
// ============================================================
// oRPC appRouter
// ============================================================
// 各 router を1つにまとめ、サーバーから /rpc/... として公開する入口です。
//
// 例:
//   appRouter.servers.list  → POST /rpc/servers/list
//   appRouter.messages.send → POST /rpc/messages/send
//
// 新しい機能を packages/api/src/routers/*.ts に追加したら、
// ここに登録しないとフロントエンドから呼べません。
// ============================================================

import { channelsRouter } from "./channels";
import { invitesRouter } from "./invites";
import { messagesRouter } from "./messages";
import { pushRouter } from "./push";
import { serversRouter } from "./servers";
import { uploadRouter } from "./upload";
import { usersRouter } from "./users";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  servers: serversRouter,
  channels: channelsRouter,
  messages: messagesRouter,
  invites: invitesRouter,
  upload: uploadRouter,
  push: pushRouter,
  users: usersRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
