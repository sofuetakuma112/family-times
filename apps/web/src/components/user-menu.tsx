import { Button } from "@family-times-new/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@family-times-new/ui/components/dropdown-menu";
import { Skeleton } from "@family-times-new/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

// ログイン状態に応じて、サインインボタンまたはユーザーメニューを表示します。
export default function UserMenu() {
  const navigate = useNavigate();
  // Better Auth の useSession は、現在ログイン中のユーザー情報を取得します。
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    // セッション確認中は、表示が跳ねないように Skeleton を出します。
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    // 未ログインならログインページへの導線だけを表示します。
    return (
      <Link to="/login">
        <Button variant="outline">Sign In</Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {session.user.name}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              // signOut 成功後はトップへ戻し、ログイン必須画面に残らないようにします。
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    navigate({
                      to: "/",
                    });
                  },
                },
              });
            }}
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
