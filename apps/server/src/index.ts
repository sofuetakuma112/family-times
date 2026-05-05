import { createContext } from "@family-times-new/api/context";
import { appRouter } from "@family-times-new/api/routers/index";
import { auth } from "@family-times-new/auth";
import { env } from "@family-times-new/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import {
  setMessageDeletedHandler,
  setMessageSentHandler,
  setMessageUpdatedHandler,
  setReactionHandler,
} from "@family-times-new/api/routers/notifications";
import {
  notifyMessageDelete,
  notifyMessageUpdate,
  notifyNewMessage,
  notifyReaction,
  websocketHandler,
} from "./ws";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

setMessageSentHandler((channelId, _serverId, messageData) => {
  notifyNewMessage(channelId, messageData);
});
setMessageUpdatedHandler((channelId, messageData) => {
  notifyMessageUpdate(channelId, messageData);
});
setMessageDeletedHandler((channelId, messageId) => {
  notifyMessageDelete(channelId, messageId);
});
setReactionHandler((channelId, messageId, reaction) => {
  notifyReaction(channelId, messageId, reaction);
});

export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

app.use("/*", async (c, next) => {
  const context = await createContext({ context: c });

  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  await next();
});

app.get("/", (c) => c.text("OK"));

const server = Bun.serve({
  port: 3002,
  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === "/ws") {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
      }

      const upgraded = server.upgrade(req, {
        data: { userId: session.user.id, channelId: null },
      });
      if (upgraded) return undefined;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    return app.fetch(req, { ip: server.requestIP(req) });
  },
  websocket: websocketHandler,
});

console.log(`Server running at http://localhost:${server.port}`);
