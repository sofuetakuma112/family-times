import { Button } from "@family-times-new/ui/components/button";
import { Input } from "@family-times-new/ui/components/input";
import { Label } from "@family-times-new/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

// 新規登録フォームです。
// TanStack Form で入力状態とバリデーションを管理し、Better Auth の signUp.email を呼び出します。
export default function SignUpForm({
  redirectTo,
  onSwitchToSignIn,
}: {
  redirectTo: string;
  onSwitchToSignIn: () => void;
}) {
  // セッション確認中はフォームを出さず、ログイン状態が確定してから表示します。
  const { isPending } = authClient.useSession();

  const form = useForm({
    // 入力欄の初期値です。TanStack Form はこの値を元に field.state.value を作ります。
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
    // バリデーションを通過した後に呼ばれる送信処理です。
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            toast.success("Sign up successful");
            // 登録完了後は、ログイン前に行こうとしていた画面へ戻します。
            window.location.href = redirectTo;
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      // 送信時に Zod でフォーム全体を検証します。
      // エラーメッセージは field.state.meta.errors から表示します。
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">Create Account</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // HTML 標準の submit ではなく、TanStack Form の送信処理を実行します。
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <div>
          {/* form.Field が name 入力欄の値・blur・change・エラーを管理します。 */}
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Name</Label>
                <Input
                  id={field.name}
                  name={field.name}
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

        <div>
          {/* email も同じ形です。type="email" はブラウザ側の入力補助にも効きます。 */}
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
          {/* password は type="password" にして入力内容を画面上で隠します。 */}
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

        {/* canSubmit/isSubmitting だけを購読し、不要な再レンダリングを抑えます。 */}
        <form.Subscribe
          selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Submitting..." : "Sign Up"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <div className="mt-4 text-center">
        <Button
          variant="link"
          onClick={onSwitchToSignIn}
          className="text-indigo-600 hover:text-indigo-800"
        >
          Already have an account? Sign In
        </Button>
      </div>
    </div>
  );
}
