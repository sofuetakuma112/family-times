// ============================================================
// WebSocket サーバー - リアルタイム通信
// ============================================================
// Bun のネイティブ WebSocket API を使ったリアルタイムチャット機能です。
//
// ■ WebSocket とは？
//   HTTP は「クライアントがリクエスト → サーバーがレスポンス」の一方向通信。
//   WebSocket は「クライアント ⇄ サーバー」の双方向通信を提供します。
//   接続を維持し続けるので、サーバーからクライアントへ即座に通知を送れます。
//
// ■ ルーム（チャンネル）方式:
//   各チャンネルが「ルーム」に対応し、接続しているユーザーのセットを管理します。
//   新しいメッセージが来たら、そのチャンネルのルームにいる全員に配信します。
//
// ■ クライアント → サーバーのメッセージ:
//   { type: "join",   channelId: "xxx" } → チャンネルに参加
//   { type: "leave",  channelId: "xxx" } → チャンネルから退出
//   { type: "typing", channelId: "xxx" } → 入力中通知
//   { type: "ping" }                     → 接続確認
//
// ■ サーバー → クライアントのメッセージ:
//   { type: "new_message",     message: {...} }  → 新規メッセージ
//   { type: "message_updated", message: {...} }  → メッセージ編集
//   { type: "message_deleted", messageId: "xxx" } → メッセージ削除
//   { type: "reaction",        ... }              → リアクション
//   { type: "typing",          userId: "xxx" }    → 他ユーザーの入力中通知
//   { type: "pong" }                              → ping への応答
// ============================================================

import type { ServerWebSocket } from "bun";
import { db } from "@family-times-new/db";
import { serverMember, channel } from "@family-times-new/db/schema/app";
import { eq, and } from "@family-times-new/db/helpers";

// WebSocket 接続に紐づくデータの型
interface WSData {
  userId: string;        // 接続ユーザーのID（認証時にセット）
  channelId: string | null; // 現在参加しているチャンネルID
}

// ─── ルーム管理 ─────────────────────────────────────────────
// channelId → そのチャンネルに接続している WebSocket のセット
const channelRooms = new Map<string, Set<ServerWebSocket<WSData>>>();

/** チャンネルのルームを取得（なければ作成） */
export function getChannelRoom(channelId: string): Set<ServerWebSocket<WSData>> {
  let room = channelRooms.get(channelId);
  if (!room) {
    room = new Set();
    channelRooms.set(channelId, room);
  }
  return room;
}

/** WebSocket をチャンネルに参加させる */
export function joinChannel(ws: ServerWebSocket<WSData>, channelId: string) {
  // 既に別のチャンネルにいる場合は先に退出
  if (ws.data.channelId) {
    leaveChannel(ws, ws.data.channelId);
  }
  const room = getChannelRoom(channelId);
  room.add(ws);
  ws.data.channelId = channelId;
}

/** WebSocket をチャンネルから退出させる */
export function leaveChannel(ws: ServerWebSocket<WSData>, channelId: string) {
  const room = channelRooms.get(channelId);
  if (room) {
    room.delete(ws);
    // ルームが空になったらメモリから削除
    if (room.size === 0) {
      channelRooms.delete(channelId);
    }
  }
}

/** チャンネル内の全員にメッセージを配信する（送信者自身は除外可能） */
export function broadcastToChannel(
  channelId: string,
  data: unknown,
  excludeWs?: ServerWebSocket<WSData>,
) {
  const room = channelRooms.get(channelId);
  if (!room) return;
  const message = JSON.stringify(data);
  for (const ws of room) {
    if (ws !== excludeWs) {
      ws.send(message);
    }
  }
}

/**
 * チャンネルアクセス権の検証
 * チャンネルが存在し、ユーザーがそのサーバーのメンバーであるか確認
 */
async function verifyChannelAccess(userId: string, channelId: string): Promise<boolean> {
  // まずチャンネルからサーバーIDを取得
  const ch = await db
    .select({ serverId: channel.serverId })
    .from(channel)
    .where(eq(channel.id, channelId))
    .get();
  if (!ch) return false;

  // サーバーのメンバーか確認
  const member = await db
    .select()
    .from(serverMember)
    .where(
      and(eq(serverMember.serverId, ch.serverId), eq(serverMember.userId, userId)),
    )
    .get();
  return !!member; // member が存在すれば true
}

// ─── メッセージ型定義 ───────────────────────────────────────
// クライアントから受信するメッセージの型（Union型でバリエーションを表現）
type WSMessage =
  | { type: "join"; channelId: string }
  | { type: "leave"; channelId: string }
  | { type: "typing"; channelId: string }
  | { type: "ping" };

/** 受信データが有効な WSMessage かどうかを検証する型ガード関数 */
function isWSMessage(raw: unknown): raw is WSMessage {
  if (!raw || typeof raw !== "object") return false;
  if (!("type" in raw)) return false;
  if (raw.type === "ping") return true;
  if (!("channelId" in raw) || typeof raw.channelId !== "string") return false;
  return raw.type === "join" || raw.type === "leave" || raw.type === "typing";
}

// ─── Bun WebSocket ハンドラー ───────────────────────────────
// Bun.serve() の websocket オプションに渡す。
// open / message / close の3つのイベントを処理する。
export const websocketHandler = {
  /** WebSocket 接続が確立されたとき（userId は HTTP アップグレード時にセット済み） */
  open(_ws: ServerWebSocket<WSData>) {
    // 特に処理なし（認証は HTTP アップグレード時に完了）
  },

  /** クライアントからメッセージを受信したとき */
  async message(ws: ServerWebSocket<WSData>, message: string | Buffer) {
    try {
      const raw: unknown = JSON.parse(
        typeof message === "string" ? message : message.toString(),
      );

      // 型ガードで不正なメッセージを除外
      if (!isWSMessage(raw)) return;
      const data = raw;

      switch (data.type) {
        case "join": {
          // チャンネル参加: アクセス権を確認してからルームに追加
          const hasAccess = await verifyChannelAccess(ws.data.userId, data.channelId);
          if (!hasAccess) {
            ws.send(JSON.stringify({ type: "error", message: "Access denied" }));
            return;
          }
          joinChannel(ws, data.channelId);
          break;
        }

        case "leave":
          // チャンネル退出
          if (ws.data.channelId) {
            leaveChannel(ws, ws.data.channelId);
            ws.data.channelId = null;
          }
          break;

        case "typing":
          // 入力中通知: 同じチャンネルの他メンバーに配信（自分自身は除外）
          if (ws.data.channelId) {
            broadcastToChannel(
              ws.data.channelId,
              { type: "typing", userId: ws.data.userId },
              ws, // 自分自身には送らない
            );
          }
          break;

        case "ping":
          // 接続維持用のping/pong
          ws.send(JSON.stringify({ type: "pong" }));
          break;
      }
    } catch {
      // JSON パースエラー等は無視（不正なメッセージ対策）
    }
  },

  /** WebSocket 接続が切断されたとき */
  close(ws: ServerWebSocket<WSData>) {
    // チャンネルから退出してルームをクリーンアップ
    if (ws.data.channelId) {
      leaveChannel(ws, ws.data.channelId);
    }
  },
};

// ─── サーバーサイドからのブロードキャスト関数 ───────────────
// oRPC のメッセージ送信ハンドラーから呼び出される

/** 新しいメッセージをチャンネルに配信 */
export function notifyNewMessage(channelId: string, messageData: unknown) {
  broadcastToChannel(channelId, { type: "new_message", message: messageData });
}

/** メッセージ更新をチャンネルに配信 */
export function notifyMessageUpdate(channelId: string, messageData: unknown) {
  broadcastToChannel(channelId, { type: "message_updated", message: messageData });
}

/** メッセージ削除をチャンネルに配信 */
export function notifyMessageDelete(channelId: string, messageId: string) {
  broadcastToChannel(channelId, { type: "message_deleted", messageId });
}

/** リアクション変更をチャンネルに配信 */
export function notifyReaction(
  channelId: string,
  messageId: string,
  reaction: { emoji: string; userId: string; action: "added" | "removed" },
) {
  broadcastToChannel(channelId, { type: "reaction", messageId, ...reaction });
}
