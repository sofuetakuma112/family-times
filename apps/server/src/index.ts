// ============================================================
// Hono + Bun サーバー - メインエントリーポイント
// ============================================================
// このファイルはバックエンドサーバーのエントリーポイントです。
//
// ■ Hono とは？
//   軽量で高速なWebフレームワークです（Express.js の代替）。
//   Bun / Cloudflare Workers / Node.js など様々なランタイムで動作します。
//   ミドルウェアベースの設計で、リクエスト処理のパイプラインを構築します。
//
// ■ このサーバーの責務:
//   1. REST API（Better-Auth 認証エンドポイント）
//   2. oRPC API（型安全なRPCエンドポイント）
//   3. WebSocket（リアルタイムチャット通信）
//   4. ファイルアップロード / 画像配信
//   5. プッシュ通知の VAPID キー配信
//
// ■ リクエストの流れ:
//   ブラウザ → Bun.serve() → WebSocket? → ws.ts
//                           → HTTP? → Hono app → ミドルウェア → ルートハンドラー
// ============================================================

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

import { getUploadPresignedUrl, getDownloadPresignedUrl, getImageKey } from "./lib/storage";
import { getVapidPublicKey } from "./lib/push";
import { websocketHandler } from "./ws";

// ─── Hono アプリケーションの作成 ────────────────────────────
const app = new Hono();

// ─── ミドルウェアの登録 ─────────────────────────────────────
// Hono のミドルウェアは app.use() で登録し、全リクエストに対して順番に実行される

// logger(): リクエストのログを出力する（開発時のデバッグ用）
app.use(logger());

// cors(): CORS（Cross-Origin Resource Sharing）の設定
// フロントエンド（port 3001）からバックエンド（port 3002）へのリクエストを許可
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,  // 許可するオリジン（フロントエンドのURL）
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,  // Cookie の送受信を許可（認証に必要）
  }),
);

// ─── Better-Auth のルーティング ─────────────────────────────
// /api/auth/* へのリクエストを Better-Auth に委譲
// Better-Auth が自動的にサインイン・サインアップ・セッション管理のAPIを提供
// 例: POST /api/auth/sign-in/email → メールでログイン
//     GET  /api/auth/get-session   → セッション情報を取得
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// ─── VAPID 公開鍵エンドポイント ─────────────────────────────
// クライアントが Web Push 通知を購読する際に必要な VAPID 公開鍵を返す
app.get("/api/push/vapid-key", (c) => {
  const key = getVapidPublicKey();
  if (!key) {
    return c.json({ error: "Push not configured" }, 500);
  }
  return c.json({ publicKey: key });
});

// ─── ファイルアップロード（Presigned URL生成）──────────────
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

// ─── 依存性の注入（DI: Dependency Injection）──────────────
// packages/api のルーターに、サーバー固有の実装を注入する
import { createUploadToken, validateUploadToken } from "./lib/upload-tokens";
import { setUploadTokenCreator, setS3PresignedUrlGetter } from "@family-times-new/api/routers/upload";
import { setMessageSentHandler } from "@family-times-new/api/routers/notifications";
import { notifyNewMessage } from "./ws";
import { sendPushToServerMembers } from "./lib/push";

// アップロードトークン生成関数を注入
setUploadTokenCreator(createUploadToken);

// メッセージ送信時の通知ハンドラーを注入
// → WebSocket でリアルタイム通知 + プッシュ通知の送信
setMessageSentHandler((channelId, serverId, messageData) => {
  // 同じチャンネルにいるユーザーにリアルタイム通知（WebSocket）
  notifyNewMessage(channelId, messageData);
  // サーバーの全メンバーにプッシュ通知（送信者自身は除外）
  sendPushToServerMembers(serverId, messageData.userId, {
    title: messageData.author?.name || "New message",
    body: messageData.message || "[image]",
    tag: `msg-${channelId}`,
    data: { channelId, serverId },
  });
});

// S3が設定されていれば、S3署名付きURL生成関数も注入
if (env.S3_ENDPOINT) {
  setS3PresignedUrlGetter(getUploadPresignedUrl);
}

// ─── ローカルファイルアップロードハンドラー ──────────────────
// S3 未設定時に使用。トークンで認証してローカルファイルシステムに保存。
app.put("/api/upload/local/:path{.+}", async (c) => {
  const filePath = c.req.param("path");
  const token = c.req.query("token");

  // アップロードトークンの検証（有効期限 + ファイルパスの一致を確認）
  if (!token || !validateUploadToken(token, filePath)) {
    return c.json({ error: "Invalid or expired upload token" }, 403);
  }

  // セキュリティ: パストラバーサル攻撃の防止
  if (filePath.includes("..") || filePath.startsWith("/")) {
    return c.json({ error: "Invalid path" }, 400);
  }

  // セキュリティ: 拡張子のホワイトリスト
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext || !["jpg", "jpeg", "png", "gif", "webp", "avif", "heic"].includes(ext)) {
    return c.json({ error: "Invalid file type" }, 400);
  }

  // セキュリティ: ファイルサイズ制限（10MB）
  const contentLength = parseInt(c.req.header("content-length") || "0", 10);
  if (contentLength > 10 * 1024 * 1024) {
    return c.json({ error: "File too large" }, 413);
  }

  const fullPath = `./uploads/${filePath}`;
  const dir = fullPath.split("/").slice(0, -1).join("/");
  const { mkdirSync } = await import("fs");
  mkdirSync(dir, { recursive: true }); // ディレクトリがなければ作成
  const body = await c.req.arrayBuffer();

  // ボディサイズも再チェック（Content-Length ヘッダーの改ざん対策）
  if (body.byteLength > 10 * 1024 * 1024) {
    return c.json({ error: "File too large" }, 413);
  }

  // Bun.write(): Bun 独自の高速ファイル書き込みAPI
  await Bun.write(fullPath, body);
  return c.json({ success: true });
});

// ─── 画像配信エンドポイント ─────────────────────────────────
app.get("/api/images/:path{.+}", async (c) => {
  const path = c.req.param("path");

  if (path.includes("..") || path.startsWith("/")) {
    return c.json({ error: "Invalid path" }, 400);
  }

  // S3 モード: 署名付きURLにリダイレクト
  if (env.S3_ENDPOINT) {
    const url = await getDownloadPresignedUrl(path);
    return c.redirect(url);
  }

  // ローカルモード: 認証チェック後にファイルを返す
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Bun.file(): Bun 独自のファイル読み取りAPI（ストリーミング対応）
  const file = Bun.file(`./uploads/${path}`);
  if (await file.exists()) {
    return new Response(file.stream(), {
      headers: {
        "Content-Type": file.type || "image/jpeg",
        "Cache-Control": "public, max-age=31536000", // 1年キャッシュ
      },
    });
  }
  return c.json({ error: "Not found" }, 404);
});

// ─── oRPC ハンドラーの作成 ──────────────────────────────────
// OpenAPI ハンドラー: Swagger UI 等でAPI仕様を確認できるエンドポイント
export const apiHandler = new OpenAPIHandler(appRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      // Zod スキーマを JSON Schema に変換（OpenAPI 仕様書生成用）
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

// RPC ハンドラー: oRPC クライアントからの RPC 呼び出しを処理
// フロントエンドの client.servers.create({...}) のようなコールがここで処理される
export const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

// ─── oRPC ルーティング ──────────────────────────────────────
// 全リクエストに対して oRPC のハンドラーを適用
app.use("/*", async (c, next) => {
  // リクエストごとに oRPC コンテキストを作成（セッション情報を含む）
  const context = await createContext({ context: c });

  // /rpc/* パスへのリクエストを RPC ハンドラーで処理
  const rpcResult = await rpcHandler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  // /api-reference/* パスへのリクエストを OpenAPI ハンドラーで処理
  const apiResult = await apiHandler.handle(c.req.raw, {
    prefix: "/api-reference",
    context: context,
  });

  if (apiResult.matched) {
    return c.newResponse(apiResult.response.body, apiResult.response);
  }

  // どちらにもマッチしなければ次のミドルウェア/ルートへ
  await next();
});

// ルートパスのヘルスチェック
app.get("/", (c) => {
  return c.text("OK");
});

// ─── Bun サーバー起動 ───────────────────────────────────────
// Bun.serve() は Bun 独自の HTTP サーバー API。
// WebSocket のアップグレードもネイティブでサポートしている。
const server = Bun.serve({
  port: 3002,
  async fetch(req, server) {
    const url = new URL(req.url);

    // ─── WebSocket アップグレード ──────────────────────────
    // /ws へのリクエストは WebSocket 接続に切り替える
    if (url.pathname === "/ws") {
      // Cookie から認証情報を取得（Better-Auth のセッション）
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session?.user?.id) {
        return new Response("Unauthorized", { status: 401 });
      }

      // HTTP → WebSocket にプロトコルをアップグレード
      // data: WebSocket 接続に紐づくユーザー情報
      const upgraded = server.upgrade(req, {
        data: { userId: session.user.id, channelId: null },
      });
      if (upgraded) return undefined; // アップグレード成功
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // 通常の HTTP リクエストは Hono に委譲
    return app.fetch(req, { ip: server.requestIP(req) });
  },
  // WebSocket のイベントハンドラー（ws.ts で定義）
  websocket: websocketHandler,
});

console.log(`Server running at http://localhost:${server.port}`);
