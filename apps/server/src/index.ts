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
import { setS3PresignedUrlGetter, setUploadTokenCreator } from "@family-times-new/api/routers/upload";
import { getDownloadPresignedUrl, getImageKey, getUploadPresignedUrl } from "./lib/storage";
import { createUploadToken, validateUploadToken } from "./lib/upload-tokens";
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

setUploadTokenCreator(createUploadToken);
if (env.S3_ENDPOINT) {
  setS3PresignedUrlGetter(getUploadPresignedUrl);
}

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

app.post("/api/upload/presign", async (c) => {
  const body = await c.req.json();
  const { photoId, extension, path, contentType } = body;
  const key = getImageKey(path, photoId, extension);

  if (env.S3_ENDPOINT) {
    const url = await getUploadPresignedUrl(key, contentType);
    return c.json({ uploadUrl: url, key });
  }

  const token = createUploadToken(key);
  return c.json({
    uploadUrl: `${env.BETTER_AUTH_URL}/api/upload/local/${key}?token=${token}`,
    key,
  });
});

app.put("/api/upload/local/:path{.+}", async (c) => {
  const filePath = c.req.param("path");
  const token = c.req.query("token");

  if (!token || !validateUploadToken(token, filePath)) {
    return c.json({ error: "Invalid or expired upload token" }, 403);
  }
  if (filePath.includes("..") || filePath.startsWith("/")) {
    return c.json({ error: "Invalid path" }, 400);
  }

  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext || !["jpg", "jpeg", "png", "gif", "webp", "avif", "heic"].includes(ext)) {
    return c.json({ error: "Invalid file type" }, 400);
  }

  const contentLength = parseInt(c.req.header("content-length") || "0", 10);
  if (contentLength > 10 * 1024 * 1024) {
    return c.json({ error: "File too large" }, 413);
  }

  const fullPath = `./uploads/${filePath}`;
  const dir = fullPath.split("/").slice(0, -1).join("/");
  const { mkdirSync } = await import("fs");
  mkdirSync(dir, { recursive: true });

  const body = await c.req.arrayBuffer();
  if (body.byteLength > 10 * 1024 * 1024) {
    return c.json({ error: "File too large" }, 413);
  }

  await Bun.write(fullPath, body);
  return c.json({ success: true });
});

app.get("/api/images/:path{.+}", async (c) => {
  const path = c.req.param("path");

  if (path.includes("..") || path.startsWith("/")) {
    return c.json({ error: "Invalid path" }, 400);
  }

  if (env.S3_ENDPOINT) {
    const url = await getDownloadPresignedUrl(path);
    return c.redirect(url);
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const file = Bun.file(`./uploads/${path}`);
  if (await file.exists()) {
    return new Response(file.stream(), {
      headers: {
        "Content-Type": file.type || "image/jpeg",
        "Cache-Control": "public, max-age=31536000",
      },
    });
  }

  return c.json({ error: "Not found" }, 404);
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
