// ============================================================
// プッシュ通知フック - Web Push API のクライアントサイド
// ============================================================
// ブラウザのプッシュ通知を管理するカスタムフックです。
//
// ■ Web Push 通知の仕組み（クライアントサイド）:
//   1. ブラウザが対応しているか確認（"PushManager" in window）
//   2. ユーザーに通知許可を求める（Notification.requestPermission()）
//   3. Service Worker を登録（プッシュ通知を受信するバックグラウンドスクリプト）
//   4. PushManager.subscribe() で購読情報を生成
//   5. 購読情報をAPIサーバーに送信して保存
//
// ■ Service Worker とは？
//   ブラウザのバックグラウンドで動作するスクリプト。
//   アプリが閉じていても、プッシュ通知を受信して表示できる。
//   /sw.js として public ディレクトリに配置する。
//
// ■ VAPID キーの変換:
//   サーバーから Base64URL 形式で受け取った VAPID 公開鍵を
//   PushManager が要求する Uint8Array 形式に変換する必要がある。
// ============================================================

import { useEffect, useState } from "react";
import { env } from "@family-times-new/env/web";
import { client } from "@/utils/orpc";

export type PushSubscribeResult =
  | "subscribed"
  | "denied"
  | "not-configured"
  | "unsupported";

export function usePushNotifications() {
  // 通知の許可状態: "default"（未回答）、"granted"（許可）、"denied"（拒否）
  const [permission, setPermission] = useState<NotificationPermission>("default");
  // ブラウザが Push API に対応しているか
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Service Worker と PushManager の両方に対応しているか確認
    const isSupported = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(isSupported);
    if (isSupported) {
      setPermission(Notification.permission);
    }
  }, []);

  /** プッシュ通知を購読する（ユーザーの操作で呼び出す） */
  const subscribe = async (): Promise<PushSubscribeResult> => {
    if (!supported) return "unsupported";

    try {
      // ブラウザの通知許可ダイアログを表示
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return "denied"; // ユーザーが許可しなかった場合は終了

      // Service Worker の登録
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready; // Service Worker が有効になるまで待機

      // サーバーから VAPID 公開鍵を取得
      const res = await fetch(`${env.VITE_SERVER_URL}/api/push/vapid-key`);
      if (!res.ok) {
        throw new Error("Push notifications are not configured");
      }
      const { publicKey } = await res.json();

      if (!publicKey) return "not-configured";

      // PushManager で購読情報を生成
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // ユーザーに見える通知のみ（ブラウザの要件）
        // VAPID 公開鍵を Base64URL → Uint8Array に変換
        applicationServerKey: urlBase64ToUint8Array(publicKey).slice().buffer,
      });

      const json = subscription.toJSON();

      // 購読情報をバックエンドAPIに送信して保存
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        return "not-configured";
      }

      await client.push.subscribe({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        deviceInfo: JSON.stringify({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        }),
      });
      return "subscribed";
    } catch (error) {
      console.error("Push subscription failed:", error);
      throw error;
    }
  };

  return { permission, supported, subscribe };
}

/**
 * Base64URL 文字列を Uint8Array に変換するヘルパー関数
 *
 * Web Push の VAPID キーは Base64URL 形式で配信されるが、
 * PushManager.subscribe() は ArrayBuffer を要求するため、
 * この変換が必要。
 *
 * Base64URL → Base64 → バイナリ → Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Base64URL → Base64 に変換（パディング追加 + 文字置換）
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  // Base64 → バイナリ文字列
  const rawData = atob(base64);
  // バイナリ文字列 → Uint8Array
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
