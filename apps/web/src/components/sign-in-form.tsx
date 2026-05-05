// ============================================================
// サインインフォーム
// ============================================================
// Better-Auth + TanStack Form + Zod を使ったログインフォームです。
//
// ■ TanStack Form:
//   React 用のフォーム管理ライブラリ。フォームの状態（値、エラー、送信中等）を管理。
//   form.Field コンポーネントで各フィールドをラップし、バリデーションと連携する。
//
// ■ Zod バリデーション（validators.onSubmit）:
//   送信時に Zod スキーマでバリデーションを行い、不正な値はエラー表示する。
//   z.email() → メールアドレス形式チェック
//   z.string().min(8) → 8文字以上チェック
//
// ■ Better-Auth クライアント:
//   authClient.signIn.email() → メール/パスワードでログイン
//   authClient.signIn.social({ provider: "google" }) → Google OAuth ログイン
//   authClient.useSession() → 現在のセッション状態を React Hook で取得
// ============================================================

import { Button } from "@family-times-new/ui/components/button";
import { Input } from "@family-times-new/ui/components/input";
import { Label } from "@family-times-new/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

export default function SignInForm({
  redirectTo,
  onSwitchToSignUp,
}: {
  redirectTo: string;
  onSwitchToSignUp: () => void;
}) {
  // useSession(): ログイン状態を監視する React Hook
  const { isPending } = authClient.useSession();

  // TanStack Form のフォームインスタンスを作成
  const form = useForm({
    // フォームの初期値
    defaultValues: {
      email: "",
      password: "",
    },
    // フォーム送信時のハンドラー
    onSubmit: async ({ value }) => {
      // Better-Auth のメールログインを実行
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          // ログイン成功時のコールバック
          onSuccess: () => {
            toast.success("Sign in successful");
            window.location.href = redirectTo;
          },
          // ログイン失敗時のコールバック
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    // Zod によるバリデーション（送信時に実行）
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  // セッション確認中はローディング表示
  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">Welcome Back</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit(); // TanStack Form の送信処理を実行
        }}
        className="space-y-4"
      >
        <div>
          {/* form.Field: フォームフィールドのラッパーコンポーネント */}
          {/* name でフォームの値のキーを指定、children で描画関数を渡す */}
          <form.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Email</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {/* バリデーションエラーの表示 */}
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        <div>
          <form.Field name="password">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Password</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </form.Field>
        </div>

        {/* form.Subscribe: フォームの状態を監視して描画を制御 */}
        {/* canSubmit: バリデーション通過時に true */}
        {/* isSubmitting: 送信中に true（ボタンを無効化するのに使う） */}
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Submitting..." : "Sign In"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      {/* 区切り線 */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      {/* Google OAuth ログインボタン */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() =>
          authClient.signIn.social({
            provider: "google",      // Google OAuth プロバイダー
            callbackURL: redirectTo, // ログイン成功後のリダイレクト先
          })
        }
      >
        Sign in with Google
      </Button>

      <div className="mt-4 text-center">
        <Button
          variant="link"
          onClick={onSwitchToSignUp}
          className="text-indigo-600 hover:text-indigo-800"
        >
          Need an account? Sign Up
        </Button>
      </div>
    </div>
  );
}
