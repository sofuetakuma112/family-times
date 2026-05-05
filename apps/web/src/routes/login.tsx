// ============================================================
// TanStack Router - ログインページ（"/login" ルート）
// ============================================================
// ファイルベースルーティングにより、/login パスに対応。
//
// ■ ルートガード（逆パターン）:
//   beforeLoad で「既にログイン済みなら "/" にリダイレクト」を行う。
//   → ログイン済みユーザーがログインページにアクセスするのを防ぐ。
// ============================================================

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { getUser } from "@/functions/get-user";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  beforeLoad: async ({ search }) => {
    const session = await getUser();
    // ログイン済みならトップページにリダイレクト
    if (session) {
      throw redirect({ href: normalizeRedirectPath(search.redirect) });
    }
  },
  component: LoginRoute,
});

function normalizeRedirectPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function LoginRoute() {
  // サインイン / サインアップ フォームの切り替え
  const [showSignIn, setShowSignIn] = useState(true);
  const { redirect } = Route.useSearch();
  const redirectTo = normalizeRedirectPath(redirect);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      {showSignIn ? (
        <SignInForm
          redirectTo={redirectTo}
          onSwitchToSignUp={() => setShowSignIn(false)}
        />
      ) : (
        <SignUpForm
          redirectTo={redirectTo}
          onSwitchToSignIn={() => setShowSignIn(true)}
        />
      )}
    </div>
  );
}
