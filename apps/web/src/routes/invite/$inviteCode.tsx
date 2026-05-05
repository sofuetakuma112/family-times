import { createFileRoute, redirect } from "@tanstack/react-router";

// /invite/:inviteCode 形式で開かれた古い/共有しやすい URL を、
// 実際の招待画面で使っている /invite?invite=... 形式へ寄せます。
export const Route = createFileRoute("/invite/$inviteCode")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/invite",
      search: { invite: params.inviteCode },
    });
  },
});
