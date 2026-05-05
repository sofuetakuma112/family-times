import { Reply, Pencil, Trash2, X, Check, CornerDownRight } from "lucide-react";
import MapView from "./map-view";
import { client } from "@/utils/orpc";
import { env } from "@family-times-new/env/web";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface Author {
  id: string;
  name: string;
  email: string;
  image: string | null;
  photoId: string | null;
  photoExtension: string | null;
}

interface ReplyTo {
  id: string;
  message: string | null;
  authorName: string;
  photoId: string | null;
  photoExtension: string | null;
}

interface Reaction {
  emoji: string;
  userIds: string[];
}

interface Message {
  id: string;
  channelId: string;
  serverId: string;
  userId: string;
  message: string | null;
  photoId: string | null;
  photoExtension: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  latitude: number | null;
  longitude: number | null;
  replyToId: string | null;
  isEdited: boolean;
  createdAt: Date;
  author: Author;
  reactions: Reaction[];
  replyTo: ReplyTo | null;
}

interface ChatMessageProps {
  message: Message;
  currentUserId: string;
  onReply?: (message: Message) => void;
}

export default function ChatMessage({
  message,
  currentUserId,
  onReply,
}: ChatMessageProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.message || "");
  const [actionsVisible, setActionsVisible] = useState(false);
  const isOwn = message.userId === currentUserId;

  const handleReaction = async (emoji: string) => {
    try {
      await client.messages.react({ messageId: message.id, emoji });
      queryClient.invalidateQueries({ queryKey: [["messages", "list"]] });
    } catch {
      // Ignore
    }
  };

  const handleEdit = async () => {
    if (!editText.trim()) return;
    try {
      await client.messages.update({ messageId: message.id, message: editText.trim() });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: [["messages", "list"]] });
    } catch {
      toast.error("Failed to edit message");
    }
  };

  const handleDelete = async () => {
    try {
      await client.messages.delete({ messageId: message.id });
      queryClient.invalidateQueries({ queryKey: [["messages", "list"]] });
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const timestamp = new Date(message.createdAt);
  const timeStr = timestamp.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="relative rounded-md px-2 py-1 hover:bg-accent/30"
      onClick={() => setActionsVisible(true)}
      onMouseEnter={() => setActionsVisible(true)}
      onMouseLeave={() => setActionsVisible(false)}
      onFocusCapture={() => setActionsVisible(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setActionsVisible(false);
        }
      }}
    >
      {/* Reply reference */}
      {message.replyTo && (
        <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <CornerDownRight className="h-3 w-3" />
          <span className="font-medium">{message.replyTo.authorName}</span>
          <span className="truncate">
            {message.replyTo.message || "[image]"}
          </span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold">
          {message.author.name?.charAt(0)?.toUpperCase() || "?"}
        </div>

        <div className="min-w-0 flex-1">
          {/* Author and time */}
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              {message.author.name}
            </span>
            <span className="text-xs text-muted-foreground">{timeStr}</span>
            {message.isEdited && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
          </div>

          {/* Message text or edit form */}
          {editing ? (
            <div className="mt-1 flex items-center gap-2">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEdit();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={handleEdit}
                className="rounded p-1 hover:bg-muted"
                aria-label="Save edited message"
                title="Save edited message"
              >
                <Check className="h-4 w-4 text-green-500" />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded p-1 hover:bg-muted"
                aria-label="Cancel editing message"
                title="Cancel editing message"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ) : (
            message.message && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {message.message}
              </p>
            )
          )}

          {/* Image */}
          {message.photoId && (
            <div className="mt-1">
              <div
                className="overflow-hidden rounded-md bg-muted"
                style={{
                  maxWidth: Math.min(message.imageWidth || 400, 400),
                  aspectRatio:
                    message.imageWidth && message.imageHeight
                      ? `${message.imageWidth} / ${message.imageHeight}`
                      : "auto",
                }}
              >
                <img
                  src={`${env.VITE_SERVER_URL}/api/images/servers/${message.serverId}/channels/${message.channelId}/messages/${message.photoId}.${message.photoExtension || "jpg"}`}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Location */}
          {message.latitude != null && message.longitude != null && (
            <div className="mt-1">
              <MapView latitude={message.latitude} longitude={message.longitude} />
            </div>
          )}

          {/* Reactions */}
          {message.reactions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {message.reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={() => handleReaction(r.emoji)}
                  aria-label={`Toggle ${r.emoji} reaction`}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                    r.userIds.includes(currentUserId)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span>{r.userIds.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div
          className={`absolute -top-2 right-2 items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm ${
            actionsVisible ? "flex" : "hidden"
          }`}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleReaction(emoji)}
              className="rounded p-1 text-sm hover:bg-muted"
              aria-label={`React with ${emoji}`}
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <div className="mx-0.5 h-4 w-px bg-border" />
          {onReply && (
            <button
              type="button"
              onClick={() => onReply(message)}
              className="rounded p-1 hover:bg-muted"
              title="Reply"
              aria-label="Reply to message"
            >
              <Reply className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          {isOwn && (
            <>
              <button
                type="button"
                onClick={() => { setEditing(true); setEditText(message.message || ""); }}
                className="rounded p-1 hover:bg-muted"
                title="Edit"
                aria-label="Edit message"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded p-1 hover:bg-muted"
                title="Delete"
                aria-label="Delete message"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
