// ============================================================
// Web Push 通知 - サーバーサイド送信
// ============================================================
// web-push ライブラリを使って、ブラウザのプッシュ通知を送信する。
//
// ■ Web Push の仕組み:
//   1. VAPID キー（公開鍵/秘密鍵のペア）でサーバーの身元を証明
//   2. クライアントが Service Worker + PushManager で購読情報を生成
//   3. 購読情報（endpoint, p256dh, auth）をDBに保存
//   4. メッセージ送信時に、保存された購読情報を使って
//      各ブラウザのプッシュサービス（Google/Mozilla等）にリクエスト
//   5. プッシュサービスがブラウザに通知を配信
//
// ■ VAPID（Voluntary Application Server Identification）:
//   プッシュ通知の送信者を識別するための標準規格。
//   公開鍵をクライアントに渡し、秘密鍵でリクエストに署名する。
// ============================================================

import { env } from "@family-times-new/env/server";
import { db } from "@family-times-new/db";
import { pushSubscription, serverMember } from "@family-times-new/db/schema/app";
import { eq, and, ne } from "@family-times-new/db/helpers";
import webpush from "web-push";

let initialized = false;

/** VAPID 設定の初期化（初回のみ実行） */
function initWebPush() {
  if (initialized) return;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured, push notifications disabled");
    return;
  }

  // web-push にVAPIDキーを設定
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,     // 連絡先（"mailto:..." 形式）
    env.VAPID_PUBLIC_KEY,  // 公開鍵（クライアントに渡す）
    env.VAPID_PRIVATE_KEY, // 秘密鍵（送信リクエストの署名に使う）
  );
  initialized = true;
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, string>;
  tag?: string; // 同じ tag の通知はグループ化される
}

/**
 * 特定ユーザーの全デバイスにプッシュ通知を送信する
 *
 * 1人のユーザーが複数デバイス（スマホ + PC等）で購読している場合、
 * 全デバイスに通知を送る。
 */
export async function sendPushToUser(
  userId: string,
  payload: NotificationPayload,
) {
  initWebPush();
  if (!initialized) return;

  // ユーザーの全購読情報を取得
  const subscriptions = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));

  // Promise.allSettled: 1つが失敗しても他は続行する（1デバイスの失敗で全体を止めない）
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify(payload),
        );
      } catch (error: unknown) {
        // 410 Gone: ブラウザが購読を解除した場合（期限切れ等）
        // → DBから古い購読情報を削除する
        if (
          error &&
          typeof error === "object" &&
          "statusCode" in error &&
          error.statusCode === 410
        ) {
          await db
            .delete(pushSubscription)
            .where(eq(pushSubscription.id, sub.id));
        }
        throw error;
      }
    }),
  );

  return results;
}

/**
 * サーバーの全メンバーにプッシュ通知を送信する（送信者本人は除外）
 *
 * ne (not equal) で送信者自身を除外し、他の全メンバーに通知する。
 */
export async function sendPushToServerMembers(
  serverId: string,
  excludeUserId: string,
  payload: NotificationPayload,
) {
  initWebPush();
  if (!initialized) return;

  // 送信者以外のメンバー一覧を取得
  const members = await db
    .select({ userId: serverMember.userId })
    .from(serverMember)
    .where(
      and(
        eq(serverMember.serverId, serverId),
        ne(serverMember.userId, excludeUserId), // ne = not equal（送信者を除外）
      ),
    );

  // 各メンバーに並列で通知を送信
  await Promise.allSettled(
    members.map((member) => sendPushToUser(member.userId, payload)),
  );
}

/** VAPID 公開鍵を取得する（クライアントに返す用） */
export function getVapidPublicKey(): string | undefined {
  return env.VAPID_PUBLIC_KEY;
}
