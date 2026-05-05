import { Loader2 } from "lucide-react";

// 共通のローディング表示です。
// 認証確認やデータ取得中など、まだ画面本体を出せない場面で使います。
export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center pt-8">
      <Loader2 className="animate-spin" />
    </div>
  );
}
