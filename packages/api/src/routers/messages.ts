import { db } from "@family-times-new/db";
import { message, reaction, serverMember, channel } from "@family-times-new/db/schema/app";
import { user } from "@family-times-new/db/schema/auth";
import { eq, and, desc, lt, inArray } from "@family-times-new/db/helpers";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { notifyMessageSent } from "./notifications";

// メッセージ API ルーターです。
// すべて protectedProcedure なので、context.session.user からログイン中ユーザーを取得できます。
// 重要なのは「メッセージを読む・書く前に、その server/channel に参加しているか確認する」ことです。

/** ユーザーが server のメンバーで、かつ channel がその server に属していることを確認します。 */
async function verifyChannelAccess(userId: string, serverId: string, channelId: string) {
  // member と channel は独立して確認できるため Promise.all で同時に問い合わせます。
  const [member, ch] = await Promise.all([
    db
      .select()
      .from(serverMember)
      .where(and(eq(serverMember.serverId, serverId), eq(serverMember.userId, userId)))
      .get(),
    db
      .select()
      .from(channel)
      .where(and(eq(channel.id, channelId), eq(channel.serverId, serverId)))
      .get(),
  ]);

  if (!member) throw new Error("Not a member of this server");
  if (!ch) throw new Error("Channel does not belong to this server");
}

/** リアクション対象のメッセージが属する server に、ユーザーが参加しているか確認します。 */
async function verifyMessageAccess(userId: string, messageId: string) {
  // messageId だけでは serverId が分からないため、先にメッセージ本体を取得します。
  const msg = await db
    .select({ serverId: message.serverId, channelId: message.channelId })
    .from(message)
    .where(eq(message.id, messageId))
    .get();
  if (!msg) throw new Error("Message not found");

  const member = await db
    .select()
    .from(serverMember)
    .where(and(eq(serverMember.serverId, msg.serverId), eq(serverMember.userId, userId)))
    .get();
  if (!member) throw new Error("Not authorized");

  return msg;
}

export const messagesRouter = {
  // チャンネル内のメッセージ一覧を取得します。
  // cursor がある場合は「そのメッセージより古いもの」を返すため、上方向スクロールのページングに使えます。
  list: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        serverId: z.string(),
        limit: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      await verifyChannelAccess(userId, input.serverId, input.channelId);

      // WHERE 条件を配列で組み立て、最後に and(...conditions) でまとめます。
      const conditions = [eq(message.channelId, input.channelId)];

      if (input.cursor) {
        // cursor は最後に読んだメッセージ ID です。
        // その createdAt より古いメッセージだけに絞ることで、同じデータの重複取得を防ぎます。
        const cursorMessage = await db
          .select({ createdAt: message.createdAt })
          .from(message)
          .where(eq(message.id, input.cursor))
          .get();
        if (cursorMessage) {
          conditions.push(lt(message.createdAt, cursorMessage.createdAt));
        }
      }

      const messages = await db
        .select({
          id: message.id,
          channelId: message.channelId,
          serverId: message.serverId,
          userId: message.userId,
          message: message.message,
          photoId: message.photoId,
          photoExtension: message.photoExtension,
          imageWidth: message.imageWidth,
          imageHeight: message.imageHeight,
          latitude: message.latitude,
          longitude: message.longitude,
          replyToId: message.replyToId,
          isEdited: message.isEdited,
          createdAt: message.createdAt,
          author: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            photoId: user.photoId,
            photoExtension: user.photoExtension,
          },
        })
        .from(message)
        .innerJoin(user, eq(message.userId, user.id))
        .where(and(...conditions))
        .orderBy(desc(message.createdAt))
        // limit + 1 件取得し、1 件多く取れたら「次ページがある」と判断します。
        .limit(input.limit + 1);

      const hasMore = messages.length > input.limit;
      const items = hasMore ? messages.slice(0, input.limit) : messages;

      // メッセージ一覧とは別に、表示に必要なリアクションをまとめて取得します。
      // 1 件ずつ取りに行くと N+1 問題になりやすいため、messageId の配列で一括取得します。
      const messageIds = items.map((m) => m.id);
      let reactions: { id: string; messageId: string; userId: string; emoji: string }[] = [];

      if (messageIds.length > 0) {
        reactions = await db
          .select({
            id: reaction.id,
            messageId: reaction.messageId,
            userId: reaction.userId,
            emoji: reaction.emoji,
          })
          .from(reaction)
          .where(inArray(reaction.messageId, messageIds));
      }

      // 画面では「👍: Aさん/Bさん」のように絵文字ごとにまとめて表示したいため、
      // DB の行データを messageId -> emoji -> userIds の形へ変換します。
      const reactionsByMessage = new Map<string, { emoji: string; userIds: string[] }[]>();
      for (const r of reactions) {
        if (!reactionsByMessage.has(r.messageId)) {
          reactionsByMessage.set(r.messageId, []);
        }
        const msgReactions = reactionsByMessage.get(r.messageId)!;
        const existing = msgReactions.find((er) => er.emoji === r.emoji);
        if (existing) {
          existing.userIds.push(r.userId);
        } else {
          msgReactions.push({ emoji: r.emoji, userIds: [r.userId] });
        }
      }

      // 返信表示用に、replyToId が指す元メッセージの最小情報だけを取得します。
      const replyToIds = items.filter((m) => m.replyToId).map((m) => m.replyToId!);
      const replyMessages = new Map<
        string,
        { id: string; message: string | null; authorName: string; photoId: string | null; photoExtension: string | null }
      >();

      for (const replyId of replyToIds) {
        const reply = await db
          .select({
            id: message.id,
            message: message.message,
            authorName: user.name,
            photoId: message.photoId,
            photoExtension: message.photoExtension,
          })
          .from(message)
          .innerJoin(user, eq(message.userId, user.id))
          .where(eq(message.id, replyId))
          .get();
        if (reply) replyMessages.set(replyId, reply);
      }

      return {
        // DB からは新しい順で取っていますが、チャット画面では古い順に並べたいので reverse します。
        items: items.reverse().map((m) => ({
          ...m,
          reactions: reactionsByMessage.get(m.id) || [],
          replyTo: m.replyToId ? replyMessages.get(m.replyToId) || null : null,
        })),
        hasMore,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  // メッセージ送信です。本文・画像・位置情報・返信先はすべて任意なので nullable にしています。
  send: protectedProcedure
    .input(
      z.object({
        channelId: z.string(),
        serverId: z.string(),
        message: z.string().nullable(),
        photoId: z.string().nullable().optional(),
        photoExtension: z.string().nullable().optional(),
        imageWidth: z.number().nullable().optional(),
        imageHeight: z.number().nullable().optional(),
        latitude: z.number().nullable().optional(),
        longitude: z.number().nullable().optional(),
        replyToId: z.string().nullable().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      await verifyChannelAccess(userId, input.serverId, input.channelId);

      // DB に入れる前に ID を作っておくと、その ID で直後に author 付きの行を取り直せます。
      const messageId = crypto.randomUUID();

      await db.insert(message).values({
        id: messageId,
        channelId: input.channelId,
        serverId: input.serverId,
        userId,
        message: input.message,
        photoId: input.photoId ?? null,
        photoExtension: input.photoExtension ?? null,
        imageWidth: input.imageWidth ?? null,
        imageHeight: input.imageHeight ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        replyToId: input.replyToId ?? null,
      });

      const newMessage = await db
        .select({
          id: message.id,
          channelId: message.channelId,
          serverId: message.serverId,
          userId: message.userId,
          message: message.message,
          photoId: message.photoId,
          photoExtension: message.photoExtension,
          imageWidth: message.imageWidth,
          imageHeight: message.imageHeight,
          latitude: message.latitude,
          longitude: message.longitude,
          replyToId: message.replyToId,
          isEdited: message.isEdited,
          createdAt: message.createdAt,
          author: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            photoId: user.photoId,
            photoExtension: user.photoExtension,
          },
        })
        .from(message)
        .innerJoin(user, eq(message.userId, user.id))
        .where(eq(message.id, messageId))
        .get();

      const result = newMessage!;

      // WebSocket と Push 通知へ「新規メッセージが来た」ことを流します。
      // DB 保存後に通知することで、クライアントが再取得してもデータが存在する状態になります。
      notifyMessageSent(input.channelId, input.serverId, {
        userId: result.userId,
        message: result.message,
        author: result.author ? { name: result.author.name } : null,
      });

      return result;
    }),

  // 自分が投稿したメッセージだけを編集できます。
  update: protectedProcedure
    .input(z.object({ messageId: z.string(), message: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const msg = await db
        .select()
        .from(message)
        .where(and(eq(message.id, input.messageId), eq(message.userId, userId)))
        .get();

      if (!msg) throw new Error("Message not found or not authorized");

      await db
        .update(message)
        .set({ message: input.message, isEdited: true })
        .where(eq(message.id, input.messageId));

      return { success: true };
    }),

  // 自分が投稿したメッセージだけを削除できます。
  // 他人のメッセージ ID を指定しても、WHERE に userId が含まれるため取得できません。
  delete: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      const msg = await db
        .select()
        .from(message)
        .where(and(eq(message.id, input.messageId), eq(message.userId, userId)))
        .get();

      if (!msg) throw new Error("Message not found or not authorized");

      await db.delete(message).where(eq(message.id, input.messageId));
      return { success: true };
    }),

  // リアクションはトグル式です。
  // 既に同じ絵文字を付けていれば削除し、なければ追加します。
  react: protectedProcedure
    .input(z.object({ messageId: z.string(), emoji: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 対象メッセージが属する server のメンバーだけがリアクションできます。
      await verifyMessageAccess(userId, input.messageId);

      const existing = await db
        .select()
        .from(reaction)
        .where(
          and(
            eq(reaction.messageId, input.messageId),
            eq(reaction.userId, userId),
            eq(reaction.emoji, input.emoji),
          ),
        )
        .get();

      if (existing) {
        await db.delete(reaction).where(eq(reaction.id, existing.id));
        return { action: "removed" as const, emoji: input.emoji };
      }

      await db.insert(reaction).values({
        id: crypto.randomUUID(),
        messageId: input.messageId,
        userId,
        emoji: input.emoji,
      });

      return { action: "added" as const, emoji: input.emoji };
    }),
};
