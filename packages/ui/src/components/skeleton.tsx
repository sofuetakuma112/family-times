import { cn } from "@family-times-new/ui/lib/utils";

// データ取得中に本来の UI の代わりとして表示するプレースホルダーです。
// animate-pulse で「読み込み中」の状態を視覚的に伝えます。
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-none bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
