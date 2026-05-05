import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { getUser } from "@/functions/get-user";
import { orpc, client } from "@/utils/orpc";

// /invite?invite=xxxx のクエリ文字列を検証します。
// TanStack Router は validateSearch の結果を Route.useSearch() で型付きにしてくれます。
const searchSchema = z.object({
  invite: z.string().optional(),
});

// 招待リンクを開いたユーザーが、ログイン後に server へ参加する画面です。
export const Route = createFileRoute("/invite/")({
  validateSearch: searchSchema,
  beforeLoad: async ({ location }) => {
    // 未ログインならログインページへ送り、ログイン後にこの招待 URL へ戻れるよう redirect を渡します。
    const session = await getUser();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    return { session };
  },
  component: InviteRoute,
});

function InviteRoute() {
  const { invite } = Route.useSearch();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);

  // 招待コードが有効か、参加ボタンを押す前に server 側へ確認します。
  const validation = useQuery(
    orpc.invites.validate.queryOptions({
      input: { code: invite || "" },
    }),
  );

  const handleJoin = async () => {
    if (!invite) return;
    setJoining(true);
    try {
      // 実際の参加処理です。既に参加済みの場合も成功扱いでトップへ戻します。
      const result = await client.servers.join({ inviteCode: invite });
      if (result.alreadyMember) {
        toast.info("You are already a member of this server");
      } else {
        toast.success("Joined server successfully!");
      }
      navigate({ to: "/" });
    } catch {
      toast.error("Failed to join server");
    } finally {
      setJoining(false);
    }
  };

  if (!invite) {
    // クエリ文字列がない /invite への直接アクセスでは参加先が分からないため、案内だけ表示します。
    return (
      <div className="flex min-h-svh items-center justify-center">
        <p className="text-muted-foreground">No invite code provided</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 rounded-lg border p-6">
        {validation.isLoading ? (
          <p>Checking invite...</p>
        ) : validation.data?.valid ? (
          // validate が成功した時だけ server 名と参加ボタンを表示します。
          <>
            <h2 className="text-xl font-bold">
              Join {validation.data.serverName}
            </h2>
            <p className="text-muted-foreground">
              You have been invited to join this server.
            </p>
            <button
              onClick={handleJoin}
              disabled={joining}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {joining ? "Joining..." : "Accept Invite"}
            </button>
          </>
        ) : (
          // 無効・期限切れなど、server 側が返した理由を表示します。
          <>
            <h2 className="text-xl font-bold">Invalid Invite</h2>
            <p className="text-muted-foreground">
              {validation.data && !validation.data.valid
                ? validation.data.reason
                : "This invite is invalid or has expired."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
