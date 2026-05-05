// ============================================================
// oRPC ルーター - ユーザープロフィール管理
// ============================================================

import { db } from "@family-times-new/db";
import { user } from "@family-times-new/db/schema/auth";
import { eq } from "@family-times-new/db/helpers";
import { z } from "zod";

import { protectedProcedure } from "../index";

export const usersRouter = {
  // ─── 自分のプロフィール取得 ──────────────────────────────
  // .input() を省略 → 引数なしのプロシージャ（GETリクエスト相当）
  me: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const u = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        photoId: user.photoId,
        photoExtension: user.photoExtension,
      })
      .from(user)
      .where(eq(user.id, userId))
      .get(); // .get() は1件のみ取得（見つからなければ undefined）

    return u;
  }),

  // ─── プロフィール更新 ────────────────────────────────────
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(50).optional(),
        photoId: z.string().optional(),
        photoExtension: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 変更があるフィールドだけ更新オブジェクトに追加
      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.photoId !== undefined) updates.photoId = input.photoId;
      if (input.photoExtension !== undefined)
        updates.photoExtension = input.photoExtension;

      // 更新対象がある場合のみ DB 更新を実行
      if (Object.keys(updates).length > 0) {
        await db.update(user).set(updates).where(eq(user.id, userId));
      }

      return { success: true };
    }),
};
