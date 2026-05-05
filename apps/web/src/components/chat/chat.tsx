// ============================================================
// Chat コンポーネント - チャットメイン画面
// ============================================================
// メッセージ一覧の表示、返信、メンバー表示、招待リンク作成を行う。
//
// ■ useQuery と orpc の組み合わせ:
//   useQuery(orpc.messages.list.queryOptions({ input: {...} }))
//   → oRPC が queryKey（キャッシュキー）と queryFn（フェッチ関数）を
//     自動生成し、TanStack Query がキャッシュ管理と再フェッチを行う。
//
// ■ client（oRPC直接呼び出し）:
//   client.invites.create({...}) のように、
//   useQuery を使わずに直接APIを呼び出すこともできる。
//   useMutation の代わりにイベントハンドラー内で使用。
// ============================================================

import { useRef, useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Menu, Hash, Users, X, Share2 } from "lucide-react";
import { toast } from "sonner";

import { orpc, client } from "@/utils/orpc";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import ChatMessage from "./chat-message";
import ChatInputArea from "./chat-input-area";

interface ReplyTarget {
  id: string;
  message: string | null;
  authorName: string;
}

interface ChatProps {
  serverId: string;
  channelId: string;
  channelName: string;
  session: {
    user: { id: string; name: string; email: string; image?: string | null };
  };
  onOpenSidebar: () => void;
}

export default function Chat({
  serverId,
  channelId,
  channelName,
  session,
  onOpenSidebar,
}: ChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const pushNotifications = usePushNotifications();

  const messages = useQuery(
    orpc.messages.list.queryOptions({
      input: { channelId, serverId, limit: 50 },
    }),
  );

  const members = useQuery(
    orpc.servers.members.queryOptions({
      input: { serverId },
      enabled: showMembers,
    }),
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.data?.items]);

  const handleReply = useCallback((msg: { id: string; message: string | null; author: { name: string } }) => {
    setReplyTarget({
      id: msg.id,
      message: msg.message,
      authorName: msg.author.name,
    });
  }, []);

  const handleCreateInvite = async () => {
    try {
      const result = await client.invites.create({ serverId });
      const url = `${window.location.origin}/invite/${result.code}`;
      await navigator.clipboard.writeText(url);
      toast.success(`Invite link copied: ${result.code}`);
    } catch {
      toast.error("Failed to create invite");
    }
  };

  const handleEnableNotifications = async () => {
    if (pushNotifications.permission === "granted") {
      toast.info("Notifications are already enabled");
      return;
    }

    setNotificationsBusy(true);
    try {
      const result = await pushNotifications.subscribe();
      if (result === "subscribed") {
        toast.success("Notifications enabled");
      } else if (result === "denied") {
        toast.error("Notification permission was denied");
      } else if (result === "unsupported") {
        toast.error("Notifications are not supported in this browser");
      } else {
        toast.error("Push notifications are not configured");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to enable notifications");
    } finally {
      setNotificationsBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="rounded p-1 hover:bg-muted md:hidden"
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Hash className="h-5 w-5 text-muted-foreground" />
        <h2 className="flex-1 font-semibold">{channelName}</h2>
        <button
          type="button"
          onClick={handleCreateInvite}
          className="rounded p-1 hover:bg-muted"
          title="Create invite link"
          aria-label="Create invite link"
        >
          <Share2 className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={handleEnableNotifications}
          disabled={notificationsBusy || pushNotifications.permission === "granted"}
          className="rounded p-1 hover:bg-muted disabled:opacity-50"
          title={
            pushNotifications.permission === "granted"
              ? "Notifications enabled"
              : "Enable notifications"
          }
          aria-label={
            pushNotifications.permission === "granted"
              ? "Notifications enabled"
              : "Enable notifications"
          }
        >
          <Bell
            className={`h-4 w-4 ${
              pushNotifications.permission === "granted"
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          />
        </button>
        <button
          type="button"
          onClick={() => setShowMembers(!showMembers)}
          className={`rounded p-1 hover:bg-muted ${showMembers ? "bg-accent" : ""}`}
          title="Members"
          aria-label={showMembers ? "Hide members" : "Show members"}
        >
          <Users className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2">
            {messages.isLoading ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground">Loading messages...</p>
              </div>
            ) : messages.data?.items.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Hash className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">
                    Welcome to #{channelName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This is the beginning of the channel.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.data?.items.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    currentUserId={session.user.id}
                    onReply={handleReply}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Reply indicator */}
          {replyTarget && (
            <div className="flex items-center gap-2 border-t bg-accent/30 px-4 py-2 text-sm">
              <span className="text-muted-foreground">Replying to</span>
              <span className="font-medium">{replyTarget.authorName}</span>
              <span className="flex-1 truncate text-muted-foreground">
                {replyTarget.message || "[image]"}
              </span>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="rounded p-0.5 hover:bg-muted"
                aria-label="Cancel reply"
                title="Cancel reply"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Input area */}
          <ChatInputArea
            channelId={channelId}
            serverId={serverId}
            channelName={channelName}
            replyToId={replyTarget?.id ?? null}
            onReplySent={() => setReplyTarget(null)}
          />
        </div>

        {/* Members panel */}
        {showMembers && (
          <div className="w-48 border-l p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Members ({members.data?.length ?? 0})
            </h3>
            <div className="space-y-2">
              {members.data?.map((m) => (
                <div key={m.id} className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold">
                    {m.user.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <span className="truncate text-sm">{m.user.name}</span>
                  {m.role === "admin" && (
                    <span className="text-xs text-yellow-500">admin</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
