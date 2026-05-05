// ============================================================
// AppSidebar - サイドバーコンポーネント
// ============================================================
// サーバー一覧、チャンネル一覧、作成/削除/参加機能を提供する。
//
// ■ oRPC client の使い方（mutation パターン）:
//   TanStack Query の useMutation を使わず、
//   client.servers.create({...}) のように直接呼び出し、
//   成功後に queryClient.invalidateQueries() でキャッシュを無効化する。
//
//   invalidateQueries({ queryKey: [["servers", "list"]] })
//   → servers.list のキャッシュを無効化→次のレンダリングで自動再フェッチ
//   → UI が最新のサーバー一覧に更新される
//
// ■ authClient.signOut():
//   Better-Auth のログアウト処理。
//   サーバーサイドでセッションを無効化し、Cookie を削除する。
// ============================================================

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Hash, Plus, Settings, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { client } from "@/utils/orpc";
import { authClient } from "@/lib/auth-client";

interface Server {
  id: string;
  name: string;
  photoId: string | null;
  photoExtension: string | null;
  role: string;
}

interface Channel {
  id: string;
  channelName: string;
  serverId: string;
}

interface AppSidebarProps {
  servers: Server[];
  channels: Channel[];
  serverId: string | null;
  channelId: string | null;
  session: {
    user: { id: string; name: string; email: string; image?: string | null };
  };
  onSelectServer: (id: string) => void;
  onSelectChannel: (id: string, name: string) => void;
  onClose: () => void;
}

export default function AppSidebar({
  servers,
  channels,
  serverId,
  channelId,
  session,
  onSelectServer,
  onSelectChannel,
}: AppSidebarProps) {
  const queryClient = useQueryClient();
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [createServerError, setCreateServerError] = useState<string | null>(null);
  const [createChannelError, setCreateChannelError] = useState<string | null>(null);
  const [joinServerError, setJoinServerError] = useState<string | null>(null);

  const currentServer = servers.find((s) => s.id === serverId);
  const isAdmin = currentServer?.role === "admin";

  const handleCreateServer = async () => {
    const name = newServerName.trim();
    if (!name) {
      setCreateServerError("Server name is required");
      return;
    }
    try {
      await client.servers.create({ name });
      setNewServerName("");
      setCreateServerError(null);
      setShowCreateServer(false);
      queryClient.invalidateQueries({ queryKey: [["servers", "list"]] });
      toast.success("Server created!");
    } catch {
      toast.error("Failed to create server");
    }
  };

  const handleDeleteServer = async () => {
    if (!serverId || !confirm("Delete this server? This cannot be undone.")) return;
    try {
      await client.servers.delete({ serverId });
      queryClient.invalidateQueries({ queryKey: [["servers", "list"]] });
      toast.success("Server deleted");
    } catch {
      toast.error("Failed to delete server");
    }
  };

  const handleCreateChannel = async () => {
    const channelName = newChannelName.trim();
    if (!channelName) {
      setCreateChannelError("Channel name is required");
      return;
    }
    if (!serverId) return;
    try {
      await client.channels.create({ serverId, channelName });
      setNewChannelName("");
      setCreateChannelError(null);
      setShowCreateChannel(false);
      queryClient.invalidateQueries({ queryKey: [["channels", "list"]] });
      toast.success("Channel created!");
    } catch {
      toast.error("Failed to create channel");
    }
  };

  const handleDeleteChannel = async (chId: string) => {
    if (!confirm("Delete this channel?")) return;
    try {
      await client.channels.delete({ channelId: chId });
      queryClient.invalidateQueries({ queryKey: [["channels", "list"]] });
      toast.success("Channel deleted");
    } catch {
      toast.error("Failed to delete channel");
    }
  };

  const handleJoinServer = async () => {
    const code = inviteCode.trim();
    if (!code) {
      setJoinServerError("Invite code is required");
      return;
    }
    try {
      const result = await client.servers.join({ inviteCode: code });
      setInviteCode("");
      setJoinServerError(null);
      setShowJoinServer(false);
      queryClient.invalidateQueries({ queryKey: [["servers", "list"]] });
      toast[result.alreadyMember ? "info" : "success"](
        result.alreadyMember ? "Already a member" : "Joined server!",
      );
    } catch {
      toast.error("Failed to join server");
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="flex h-full flex-col border-r bg-sidebar">
      {/* Server list */}
      <div className="flex items-center gap-1 overflow-x-auto border-b p-2">
        {servers.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelectServer(s.id)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors ${
              s.id === serverId
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
            title={s.name}
            aria-label={`Select server ${s.name}`}
          >
            {s.name.charAt(0).toUpperCase()}
          </button>
        ))}
        <button
          onClick={() => {
            setCreateServerError(null);
            setShowCreateServer(true);
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted hover:bg-muted/80"
          title="Create or join server"
          aria-label="Create or join server"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Server name + admin actions */}
      {currentServer && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="flex-1 truncate text-sm font-semibold">{currentServer.name}</span>
          {isAdmin && (
            <button
              onClick={handleDeleteServer}
              className="rounded p-1 hover:bg-destructive/10"
              title="Delete server"
              aria-label={`Delete server ${currentServer.name}`}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          )}
        </div>
      )}

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase text-muted-foreground">
            Channels
          </span>
          {serverId && (
            <button
              onClick={() => {
                setCreateChannelError(null);
                setShowCreateChannel(true);
              }}
              className="rounded p-0.5 hover:bg-muted"
              title="Create channel"
              aria-label="Create channel"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        {channels.map((ch) => (
          <div
            key={ch.id}
            className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
              ch.id === channelId
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            <button
              onClick={() => onSelectChannel(ch.id, ch.channelName)}
              className="flex flex-1 items-center gap-2"
              aria-label={`Select channel ${ch.channelName}`}
            >
              <Hash className="h-4 w-4 shrink-0" />
              <span className="truncate">{ch.channelName}</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => handleDeleteChannel(ch.id)}
                className="hidden rounded p-0.5 hover:bg-destructive/10 group-hover:block"
                title="Delete channel"
                aria-label={`Delete channel ${ch.channelName}`}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* User area */}
      <div className="flex items-center gap-2 border-t p-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {session.user.name?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 truncate text-sm">{session.user.name}</div>
        <button
          onClick={() => {
            setJoinServerError(null);
            setShowJoinServer(true);
          }}
          className="rounded p-1 hover:bg-muted"
          title="Join server with code"
          aria-label="Join server with code"
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={handleSignOut}
          className="rounded p-1 hover:bg-muted"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Dialogs */}
      {showCreateServer && (
        <Dialog title="Create Server" onClose={() => setShowCreateServer(false)}>
          <input value={newServerName} onChange={(e) => { setNewServerName(e.target.value); setCreateServerError(null); }}
            placeholder="Server name" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-invalid={!!createServerError}
            aria-describedby={createServerError ? "create-server-error" : undefined}
            onKeyDown={(e) => e.key === "Enter" && handleCreateServer()} />
          {createServerError && (
            <p id="create-server-error" className="mt-2 text-sm text-destructive">
              {createServerError}
            </p>
          )}
          <button onClick={handleCreateServer}
            className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">Create</button>
        </Dialog>
      )}
      {showCreateChannel && (
        <Dialog title="Create Channel" onClose={() => setShowCreateChannel(false)}>
          <input value={newChannelName} onChange={(e) => { setNewChannelName(e.target.value); setCreateChannelError(null); }}
            placeholder="Channel name" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-invalid={!!createChannelError}
            aria-describedby={createChannelError ? "create-channel-error" : undefined}
            onKeyDown={(e) => e.key === "Enter" && handleCreateChannel()} />
          {createChannelError && (
            <p id="create-channel-error" className="mt-2 text-sm text-destructive">
              {createChannelError}
            </p>
          )}
          <button onClick={handleCreateChannel}
            className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">Create</button>
        </Dialog>
      )}
      {showJoinServer && (
        <Dialog title="Join Server" onClose={() => setShowJoinServer(false)}>
          <input value={inviteCode} onChange={(e) => { setInviteCode(e.target.value); setJoinServerError(null); }}
            placeholder="Invite code" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-invalid={!!joinServerError}
            aria-describedby={joinServerError ? "join-server-error" : undefined}
            onKeyDown={(e) => e.key === "Enter" && handleJoinServer()} />
          {joinServerError && (
            <p id="join-server-error" className="mt-2 text-sm text-destructive">
              {joinServerError}
            </p>
          )}
          <button onClick={handleJoinServer}
            className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">Join</button>
        </Dialog>
      )}
    </div>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-lg bg-background p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold">{title}</h3>
        {children}
        <button onClick={onClose}
          className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md text-sm text-muted-foreground hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}
