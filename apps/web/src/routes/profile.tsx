import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { getUser } from "@/functions/get-user";
import { client } from "@/utils/orpc";

// 初回登録後やプロフィール編集時に、表示名を設定する画面です。
export const Route = createFileRoute("/profile")({
  beforeLoad: async () => {
    // プロフィールはログイン中ユーザーの情報を更新するため、未ログインならログインへ戻します。
    const session = await getUser();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: ProfileRoute,
});

function ProfileRoute() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  // 既存の表示名があれば初期値として入れます。
  const [name, setName] = useState(session.user.name || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    // 空白だけの名前は保存しません。
    if (!name.trim()) return;
    setSaving(true);
    try {
      // oRPC 経由で server の users.updateProfile を呼び、DB の user.name を更新します。
      await client.users.updateProfile({ name: name.trim() });
      toast.success("Profile updated");
      navigate({ to: "/" });
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 p-6">
        <h1 className="text-2xl font-bold">Set up your profile</h1>
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            Display Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            // React の state を更新して、入力値と画面表示を同期させます。
            onChange={(e) => setName(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Your name"
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
