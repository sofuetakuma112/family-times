// ============================================================
// 通知ハンドラー - WebSocket & プッシュ通知のブリッジ
// ============================================================
// packages/api（ロジック層）と apps/server（実行環境）の橋渡しをする。
//
// ■ なぜこの仕組みが必要か？
//   packages/api は純粋なビジネスロジックのみを担当し、
//   WebSocket やプッシュ通知の「送信方法」は知りません。
//   apps/server 側で setMessageSentHandler() を使って
//   「新しいメッセージが来たら何をするか」を注入します。
//
// ■ 処理の流れ:
//   1. apps/server の起動時に setMessageSentHandler(コールバック) を呼ぶ
//   2. メッセージ送信時に notifyMessageSent() が呼ばれる
//   3. 登録されたコールバックが WebSocket 通知 + プッシュ通知を実行
// ============================================================

export interface MessageNotifyPayload {
  userId: string;
  message: string | null;
  author: { name: string } | null;
}

type MessageNotifyFn = (channelId: string, serverId: string, messageData: MessageNotifyPayload) => void;

// apps/server から注入される通知ハンドラー
let _onMessageSent: MessageNotifyFn | null = null;

/** 通知ハンドラーを外部から注入する（apps/server の起動時に呼ばれる） */
export function setMessageSentHandler(fn: MessageNotifyFn) {
  _onMessageSent = fn;
}

/** メッセージ送信時に呼ばれる通知関数（messages.send から呼ばれる） */
export function notifyMessageSent(channelId: string, serverId: string, messageData: MessageNotifyPayload) {
  // ?.() はオプショナルチェイニング: _onMessageSent が null なら何もしない
  _onMessageSent?.(channelId, serverId, messageData);
}
