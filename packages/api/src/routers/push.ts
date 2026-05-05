import { db } from "@family-times-new/db";
import { pushSubscription } from "@family-times-new/db/schema/app";
import { eq, and } from "@family-times-new/db/helpers";
import { z } from "zod";

import { protectedProcedure } from "../index";

// Web Push 通知の購読情報を登録・削除する API です。
// endpoint/p256dh/auth はブラウザの PushManager が発行し、通知送信時に必要になります。
export const pushRouter = {
  // 現在のブラウザ端末を通知先として登録します。
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string(),
        p256dh: z.string(),
        auth: z.string(),
        deviceInfo: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 同じ endpoint が既にあれば更新します。
      // ブラウザ側で購読情報が再発行された時も、重複行を作らず最新値へ寄せるためです。
      const existing = await db
        .select()
        .from(pushSubscription)
        .where(eq(pushSubscription.endpoint, input.endpoint))
        .get();

      if (existing) {
        await db
          .update(pushSubscription)
          .set({
            userId,
            p256dh: input.p256dh,
            auth: input.auth,
            deviceInfo: input.deviceInfo ?? null,
          })
          .where(eq(pushSubscription.id, existing.id));
      } else {
        await db.insert(pushSubscription).values({
          id: crypto.randomUUID(),
          userId,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          deviceInfo: input.deviceInfo ?? null,
        });
      }

      return { success: true };
    }),

  // 通知を無効にした端末の購読情報を削除します。
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // userId も条件に含め、他ユーザーの endpoint を削除できないようにします。
      await db
        .delete(pushSubscription)
        .where(
          and(
            eq(pushSubscription.endpoint, input.endpoint),
            eq(pushSubscription.userId, userId),
          ),
        );

      return { success: true };
    }),
};
