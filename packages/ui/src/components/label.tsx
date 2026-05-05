import { cn } from "@family-times-new/ui/lib/utils";
import * as React from "react";

// フォーム項目名に使う共通 label です。
// disabled 状態の入力欄と並べても見た目が揃うよう、状態別 class をまとめています。
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-xs leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
