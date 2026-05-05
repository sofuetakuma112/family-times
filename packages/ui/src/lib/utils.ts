import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Tailwind の className を安全に結合する共通関数です。
// clsx は条件付き class を組み立て、twMerge は p-2 と p-4 のような競合を後勝ちで整理します。
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
