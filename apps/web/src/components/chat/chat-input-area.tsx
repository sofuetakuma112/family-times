// ============================================================
// ChatInputArea - メッセージ入力エリア
// ============================================================
// テキスト入力、画像添付、メッセージ送信を行うコンポーネント。
//
// ■ oRPC client の直接呼び出し:
//   client.upload.getPresignedUrl({...}) → 署名付きURL取得
//   client.messages.send({...})          → メッセージ送信
//   TanStack Query の useMutation を使わず、直接呼び出している。
//
// ■ useQueryClient():
//   TanStack Query の QueryClient にアクセスする React Hook。
//   queryClient.invalidateQueries() でキャッシュを無効化し、
//   メッセージ一覧の再フェッチを強制する。
//
// ■ 画像アップロードの流れ:
//   1. ユーザーがファイルを選択
//   2. クライアントで UUID を生成（photoId）
//   3. oRPC で署名付きURLを取得
//   4. fetch() で署名付きURLに画像を直接PUT
//   5. messages.send() でメッセージ（photoId付き）をDBに保存
// ============================================================

import { useState, useRef, useCallback } from "react";
import { Send, ImagePlus, MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { client } from "@/utils/orpc";

interface ChatInputAreaProps {
  channelId: string;
  serverId: string;
  channelName: string;
  replyToId: string | null;
  onReplySent: () => void;
}

export default function ChatInputArea({
  channelId,
  serverId,
  channelName,
  replyToId,
  onReplySent,
}: ChatInputAreaProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const clearImageSelection = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const getImageDimensions = useCallback((file: File) => {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Selected file is not a valid image"));
      };
      img.src = objectUrl;
    });
  }, []);

  const getCurrentPosition = useCallback(() => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Location sharing is not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 10_000,
      });
    });
  }, []);

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be less than 10MB");
        e.target.value = "";
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result;
        if (typeof result === "string") setImagePreview(result);
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const submitMessage = useCallback(async ({
    latitude = null,
    longitude = null,
  }: {
    latitude?: number | null;
    longitude?: number | null;
  } = {}) => {
    let photoId: string | null = null;
    let photoExtension: string | null = null;
    let imageWidth: number | null = null;
    let imageHeight: number | null = null;

    if (imageFile) {
      photoId = crypto.randomUUID();
      photoExtension = imageFile.name.split(".").pop() || "jpg";

      const dims = await getImageDimensions(imageFile);
      imageWidth = dims.width;
      imageHeight = dims.height;

      const { uploadUrl } = await client.upload.getPresignedUrl({
        photoId,
        extension: photoExtension,
        path: `servers/${serverId}/channels/${channelId}/messages`,
        contentType: imageFile.type,
      });

      await fetch(uploadUrl, {
        method: "PUT",
        body: imageFile,
        headers: { "Content-Type": imageFile.type },
      });
    }

    await client.messages.send({
      channelId,
      serverId,
      message: text.trim() || null,
      photoId,
      photoExtension,
      imageWidth,
      imageHeight,
      latitude,
      longitude,
      replyToId,
    });

    setText("");
    clearImageSelection();
    if (replyToId) onReplySent();
    queryClient.invalidateQueries({ queryKey: [["messages", "list"]] });

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [
    channelId,
    clearImageSelection,
    getImageDimensions,
    imageFile,
    onReplySent,
    queryClient,
    replyToId,
    serverId,
    text,
  ]);

  const handleSend = async () => {
    if ((!text.trim() && !imageFile) || sending) return;

    setSending(true);
    try {
      await submitMessage();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send message";
      if (message === "Selected file is not a valid image") {
        clearImageSelection();
      }
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const handleSendLocation = async () => {
    if (sending) return;

    setSending(true);
    try {
      const position = await getCurrentPosition();
      await submitMessage({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (error) {
      toast.error(getLocationErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  return (
    <div className="border-t px-4 py-3">
      {imagePreview && (
        <div className="relative mb-2 inline-block">
          <img src={imagePreview} alt="Preview" className="h-20 rounded-md object-cover" />
          <button
            type="button"
            onClick={clearImageSelection}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
            aria-label="Remove selected image"
          >
            x
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="mb-1 rounded p-2 hover:bg-muted"
          aria-label="Upload image"
          title="Upload image"
        >
          <ImagePlus className="h-5 w-5 text-muted-foreground" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <button
          type="button"
          onClick={handleSendLocation}
          disabled={sending}
          className="mb-1 rounded p-2 hover:bg-muted disabled:opacity-50"
          aria-label="Share current location"
          title="Share current location"
        >
          <MapPin className="h-5 w-5 text-muted-foreground" />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={`Message #${channelName}`}
          rows={1}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || (!text.trim() && !imageFile)}
          className="mb-1 rounded p-2 text-primary hover:bg-muted disabled:opacity-50"
          aria-label="Send message"
          title="Send message"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function getLocationErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "code" in error) {
    const code = Number((error as { code: number }).code);
    if (code === 1) return "Location permission was denied";
    if (code === 2) return "Current location is unavailable";
    if (code === 3) return "Getting current location timed out";
  }
  return "Failed to get current location";
}
