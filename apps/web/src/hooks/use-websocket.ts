// ============================================================
// WebSocket フック - リアルタイム通信のクライアントサイド
// ============================================================
// React カスタムフックでWebSocket接続を管理します。
//
// ■ useWebSocket():
//   WebSocket の接続・切断・メッセージ送受信を管理するフック。
//   自動再接続（3秒後）、イベントハンドラーの登録/解除をサポート。
//
// ■ useChannelMessages():
//   チャンネル変更時にWebSocket経由で「参加/退出」を通知し、
//   新しいメッセージやリアクションを受信した際に
//   TanStack Query のキャッシュを無効化して自動再フェッチを行う。
//
// ■ なぜ queryClient.invalidateQueries を使うのか？
//   WebSocket で「新メッセージあり」を受信したら、
//   TanStack Query のキャッシュを無効化→再フェッチすることで、
//   メッセージ一覧が自動的に最新状態に更新される。
//   これにより WebSocket とHTTPの長所を組み合わせている。
// ============================================================

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@family-times-new/env/web";

type WSMessageHandler = (data: unknown) => void;

/**
 * WebSocket 接続を管理するカスタムフック
 *
 * @param isAuthenticated - ログイン済みかどうか（未認証なら接続しない）
 * @returns { connected, send, joinChannel, leaveChannel, on }
 */
export function useWebSocket(isAuthenticated: boolean) {
  // useRef: 再レンダリングを引き起こさない値の保持に使用
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  // イベントタイプごとのハンドラーを管理する Map
  const handlersRef = useRef<Map<string, Set<WSMessageHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const shouldReconnectRef = useRef(true);

  // WebSocket 接続を確立する関数
  const connect = useCallback(() => {
    if (!isAuthenticated) return;
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    // http:// → ws://, https:// → wss:// に変換
    const wsUrl = env.VITE_SERVER_URL.replace(/^http/, "ws");
    // Cookie による認証（URLにトークンを含めない＝セキュア）
    const ws = new WebSocket(`${wsUrl}/ws`);

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data?.type;
        if (type) {
          // 登録済みのハンドラーを全て呼び出す
          const handlers = handlersRef.current.get(type);
          handlers?.forEach((handler) => handler(data));
        }
      } catch {
        // JSON パースエラーは無視
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // 自動再接続: 3秒後に再接続を試みる
      if (shouldReconnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close(); // エラー時は切断→onclose で再接続
    };

    wsRef.current = ws;
  }, [isAuthenticated]);

  // コンポーネントマウント時に接続、アンマウント時に切断
  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  /** WebSocket でメッセージを送信する */
  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  /** 指定チャンネルに参加する */
  const joinChannel = useCallback(
    (channelId: string) => {
      send({ type: "join", channelId });
    },
    [send],
  );

  /** 指定チャンネルから退出する */
  const leaveChannel = useCallback(
    (channelId: string) => {
      send({ type: "leave", channelId });
    },
    [send],
  );

  /**
   * イベントハンドラーを登録する（Pub/Subパターン）
   * @param type - イベントタイプ（"new_message", "typing" 等）
   * @param handler - イベント受信時のコールバック
   * @returns クリーンアップ関数（ハンドラーの解除）
   */
  const on = useCallback((type: string, handler: WSMessageHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);

    // クリーンアップ関数を返す（useEffect の return で呼ばれる）
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  return useMemo(
    () => ({ connected, send, joinChannel, leaveChannel, on }),
    [connected, send, joinChannel, leaveChannel, on],
  );
}

/**
 * チャンネルのメッセージをリアルタイム同期するフック
 *
 * WebSocket で受信したイベント（new_message, reaction 等）に応じて
 * TanStack Query のキャッシュを無効化し、最新データを再フェッチさせる。
 *
 * @param ws - useWebSocket() の戻り値
 * @param channelId - 現在表示中のチャンネルID
 * @param serverId - 現在のサーバーID
 */
export function useChannelMessages(
  ws: ReturnType<typeof useWebSocket>,
  channelId: string | null,
  serverId: string | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!channelId || !serverId || !ws.connected) return;

    // チャンネルに参加（サーバーのルームに入る）
    ws.joinChannel(channelId);

    // 各種イベントのハンドラーを登録
    // invalidateQueries: キャッシュを無効化→次のアクセスで自動再フェッチ
    const unsubs = [
      ws.on("new_message", () => {
        queryClient.invalidateQueries({
          queryKey: [["messages", "list"]], // oRPC が生成するクエリキー
        });
      }),
      ws.on("message_updated", () => {
        queryClient.invalidateQueries({
          queryKey: [["messages", "list"]],
        });
      }),
      ws.on("message_deleted", () => {
        queryClient.invalidateQueries({
          queryKey: [["messages", "list"]],
        });
      }),
      ws.on("reaction", () => {
        queryClient.invalidateQueries({
          queryKey: [["messages", "list"]],
        });
      }),
    ];

    // クリーンアップ: チャンネルから退出し、ハンドラーを解除
    return () => {
      ws.leaveChannel(channelId);
      unsubs.forEach((unsub) => unsub());
    };
  }, [channelId, serverId, ws, queryClient]);
}
