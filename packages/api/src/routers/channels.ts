import { db } from "@family-times-new/db";
import { channel, serverMember } from "@family-times-new/db/schema/app";
import { eq, and, asc } from "@family-times-new/db/helpers";
import { z } from "zod";

import { protectedProcedure } from "../index";

// チャンネル API です。
// チャンネルは server の中にある会話場所なので、毎回 serverMember を確認してから操作します。
export const channelsRouter = {
  // server 内のチャンネル一覧を作成順で返します。
  list: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 参加していない server のチャンネル名を見せないための認可チェックです。
      const member = await db
        .select()
        .from(serverMember)
        .where(
          and(
            eq(serverMember.serverId, input.serverId),
            eq(serverMember.userId, userId),
          ),
        )
        .get();

      if (!member) {
        throw new Error("Not a member of this server");
      }

      // createdAt の昇順にして、最初に作られた general などが上に来るようにします。
      return db
        .select()
        .from(channel)
        .where(eq(channel.serverId, input.serverId))
        .orderBy(asc(channel.createdAt));
    }),

  // server に新しいチャンネルを作ります。
  create: protectedProcedure
    .input(
      z.object({
        serverId: z.string(),
        channelName: z.string().min(1).max(100),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 作成できるのは server のメンバーだけです。
      const member = await db
        .select()
        .from(serverMember)
        .where(
          and(
            eq(serverMember.serverId, input.serverId),
            eq(serverMember.userId, userId),
          ),
        )
        .get();

      if (!member) {
        throw new Error("Not a member of this server");
      }

      const channelId = crypto.randomUUID();

      // createdBy に作成者を残しておくと、後から監査や表示に使えます。
      await db.insert(channel).values({
        id: channelId,
        serverId: input.serverId,
        channelName: input.channelName,
        createdBy: userId,
      });

      return { id: channelId, channelName: input.channelName };
    }),

  // チャンネル削除です。削除は影響が大きいため admin のみに制限しています。
  delete: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // channelId から serverId を調べ、どの server の権限を見るべきか確定します。
      const ch = await db
        .select()
        .from(channel)
        .where(eq(channel.id, input.channelId))
        .get();

      if (!ch) {
        throw new Error("Channel not found");
      }

      // server の admin だけがチャンネルを削除できます。
      const member = await db
        .select()
        .from(serverMember)
        .where(
          and(
            eq(serverMember.serverId, ch.serverId),
            eq(serverMember.userId, userId),
            eq(serverMember.role, "admin"),
          ),
        )
        .get();

      if (!member) {
        throw new Error("Not authorized to delete this channel");
      }

      await db.delete(channel).where(eq(channel.id, input.channelId));
      return { success: true };
    }),
};
