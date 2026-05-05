import { db } from "@family-times-new/db";
import { server, serverMember, channel, serverInvite } from "@family-times-new/db/schema/app";
import { user } from "@family-times-new/db/schema/auth";
import { eq, and } from "@family-times-new/db/helpers";
import { z } from "zod";

import { protectedProcedure } from "../index";

// server は Family Times の「家族グループ」です。
// このルーターでは、グループ作成・編集・削除・参加・メンバー一覧を扱います。
export const serversRouter = {
  // ログイン中ユーザーが参加している server 一覧を返します。
  // server_member を起点にすることで、参加していない private な server は返りません。
  list: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const members = await db
      .select({
        serverId: serverMember.serverId,
        role: serverMember.role,
        server: {
          id: server.id,
          name: server.name,
          photoId: server.photoId,
          photoExtension: server.photoExtension,
          createdBy: server.createdBy,
          createdAt: server.createdAt,
        },
      })
      .from(serverMember)
      .innerJoin(server, eq(serverMember.serverId, server.id))
      .where(eq(serverMember.userId, userId));

    return members.map((m) => ({
      ...m.server,
      role: m.role,
    }));
  }),

  // 新しい server を作成します。
  // 作成者は admin として serverMember に入り、最初の channel も同時に作ります。
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        channelName: z.string().min(1).max(100).default("general"),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const serverId = crypto.randomUUID();
      const channelId = crypto.randomUUID();
      const memberId = crypto.randomUUID();

      // 3 つの INSERT は 1 つの機能としてセットなので batch でまとめて実行します。
      // server だけ作れて channel がない、という中途半端な状態を避けやすくします。
      await db.batch([
        db.insert(server).values({
          id: serverId,
          name: input.name,
          createdBy: userId,
        }),
        db.insert(serverMember).values({
          id: memberId,
          serverId,
          userId,
          role: "admin",
        }),
        db.insert(channel).values({
          id: channelId,
          serverId,
          channelName: input.channelName,
          createdBy: userId,
        }),
      ]);

      return { id: serverId, name: input.name, channelId };
    }),

  // server 名や画像情報を更新します。admin だけが実行できます。
  update: protectedProcedure
    .input(
      z.object({
        serverId: z.string(),
        name: z.string().min(1).max(100).optional(),
        photoId: z.string().optional(),
        photoExtension: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 権限チェックです。serverId + userId + role=admin の行があるか確認します。
      const member = await db
        .select()
        .from(serverMember)
        .where(
          and(
            eq(serverMember.serverId, input.serverId),
            eq(serverMember.userId, userId),
            eq(serverMember.role, "admin"),
          ),
        )
        .get();

      if (!member) {
        throw new Error("Not authorized to update this server");
      }

      // optional な input だけを更新対象に入れます。
      // undefined をそのまま set しないことで、未指定の項目を上書きしません。
      const updates: Record<string, unknown> = {};
      if (input.name) updates.name = input.name;
      if (input.photoId) updates.photoId = input.photoId;
      if (input.photoExtension) updates.photoExtension = input.photoExtension;

      await db.update(server).set(updates).where(eq(server.id, input.serverId));

      return { success: true };
    }),

  // server を削除します。admin だけが実行できます。
  // schema 側で onDelete: "cascade" を設定した関連データも一緒に削除されます。
  delete: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // update と同じく、削除権限がある admin メンバーかを確認します。
      const member = await db
        .select()
        .from(serverMember)
        .where(
          and(
            eq(serverMember.serverId, input.serverId),
            eq(serverMember.userId, userId),
            eq(serverMember.role, "admin"),
          ),
        )
        .get();

      if (!member) {
        throw new Error("Not authorized to delete this server");
      }

      await db.delete(server).where(eq(server.id, input.serverId));
      return { success: true };
    }),

  // server のメンバー一覧を取得します。
  // 参加者だけが一覧を見られるよう、先に自分の membership を確認します。
  members: protectedProcedure
    .input(z.object({ serverId: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // ログイン中ユーザーがこの server のメンバーか確認します。
      const isMember = await db
        .select()
        .from(serverMember)
        .where(
          and(
            eq(serverMember.serverId, input.serverId),
            eq(serverMember.userId, userId),
          ),
        )
        .get();

      if (!isMember) {
        throw new Error("Not a member of this server");
      }

      // serverMember と user を join して、権限(role)と表示名/画像を一緒に返します。
      const members = await db
        .select({
          id: serverMember.id,
          userId: serverMember.userId,
          role: serverMember.role,
          joinedAt: serverMember.joinedAt,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            photoId: user.photoId,
            photoExtension: user.photoExtension,
          },
        })
        .from(serverMember)
        .innerJoin(user, eq(serverMember.userId, user.id))
        .where(eq(serverMember.serverId, input.serverId));

      return members;
    }),

  // 招待コードを使って server に参加します。
  join: protectedProcedure
    .input(z.object({ inviteCode: z.string() }))
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // URL から受け取った inviteCode が DB に存在するか確認します。
      const invite = await db
        .select()
        .from(serverInvite)
        .where(eq(serverInvite.code, input.inviteCode))
        .get();

      if (!invite) {
        throw new Error("Invalid invite code");
      }

      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new Error("Invite has expired");
      }

      // すでに参加済みなら INSERT せず、画面側で適切なメッセージを出せるようにします。
      const existing = await db
        .select()
        .from(serverMember)
        .where(
          and(
            eq(serverMember.serverId, invite.serverId),
            eq(serverMember.userId, userId),
          ),
        )
        .get();

      if (existing) {
        return { serverId: invite.serverId, alreadyMember: true };
      }

      // 参加レコードの作成と招待使用回数の加算は、同じ参加処理としてまとめて実行します。
      await db.batch([
        db.insert(serverMember).values({
          id: crypto.randomUUID(),
          serverId: invite.serverId,
          userId,
          role: "member",
        }),
        db
          .update(serverInvite)
          .set({ uses: invite.uses + 1 })
          .where(eq(serverInvite.id, invite.id)),
      ]);

      return { serverId: invite.serverId, alreadyMember: false };
    }),
};
