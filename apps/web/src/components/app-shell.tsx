// ============================================================
// AppShell - アプリケーションの主要レイアウト
// ============================================================
// サイドバー + チャットエリアの2カラムレイアウトを構成します。
//
// ■ TanStack Query の useQuery():
//   データフェッチ + キャッシュ + 自動再フェッチを管理するフック。
//   orpc.servers.list.queryOptions() で oRPC のクエリオプションを自動生成し、
//   useQuery() に渡すことで型安全なデータフェッチが行われる。
//
//   戻り値:
//   - data: フェッチしたデータ（undefined → データ到着後に値が入る）
//   - isLoading: 初回ロード中かどうか
//   - error: エラー情報
//
// ■ enabled オプション:
//   useQuery({ ..., enabled: !!serverId }) のように指定すると、
//   enabled が false の間はクエリを実行しない。
//   サーバーが選択されるまでチャンネル一覧を取得しない、という制御に使う。
// ============================================================

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";
import { useWebSocket, useChannelMessages } from "@/hooks/use-websocket";
import AppSidebar from "./sidebar/app-sidebar";
import Chat from "./chat/chat";

interface AppShellProps {
  session: {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
    };
    session: {
      token: string;
    };
  };
}

export default function AppShell({ session }: AppShellProps) {
  const [serverId, setServerId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // WebSocket 接続を確立（認証済みの場合のみ）
  const ws = useWebSocket(!!session);
  // チャンネルの WebSocket イベントを監視し、TanStack Query のキャッシュを自動更新
  useChannelMessages(ws, channelId, serverId);

  // ─── TanStack Query によるデータフェッチ ───────────────────
  // useQuery(orpc.xxx.queryOptions()) パターン:
  // oRPC が queryKey と queryFn を自動生成し、TanStack Query に渡す

  // サーバー一覧を取得（ログイン後に自動フェッチ）
  const servers = useQuery(orpc.servers.list.queryOptions());

  // チャンネル一覧を取得（サーバー選択後にフェッチ）
  // enabled: !!serverId → serverId が選択されるまでクエリを実行しない
  const channels = useQuery(
    orpc.channels.list.queryOptions({
      input: { serverId: serverId! },
      enabled: !!serverId,
    }),
  );

  const handleSelectServer = useCallback(
    (id: string) => {
      setServerId(id);
      setChannelId(null);
      setChannelName(null);
    },
    [],
  );

  const handleSelectChannel = useCallback(
    (id: string, name: string) => {
      setChannelId(id);
      setChannelName(name);
      setSidebarOpen(false);
    },
    [],
  );

  // Auto-select first server and channel
  if (!serverId && servers.data && servers.data.length > 0) {
    setServerId(servers.data[0].id);
  }
  if (
    serverId &&
    !channelId &&
    channels.data &&
    channels.data.length > 0
  ) {
    setChannelId(channels.data[0].id);
    setChannelName(channels.data[0].channelName);
  }

  return (
    <div className="flex h-svh overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-30 w-64 transition-transform md:relative md:translate-x-0`}
      >
        <AppSidebar
          servers={servers.data || []}
          channels={channels.data || []}
          serverId={serverId}
          channelId={channelId}
          session={session}
          onSelectServer={handleSelectServer}
          onSelectChannel={handleSelectChannel}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-y-0 left-64 right-0 z-20 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {serverId && channelId ? (
          <Chat
            serverId={serverId}
            channelId={channelId}
            channelName={channelName || ""}
            session={session}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">
              {servers.isLoading
                ? "Loading..."
                : "Select a server and channel to start chatting"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
