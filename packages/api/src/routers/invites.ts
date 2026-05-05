import { db } from "@family-times-new/db";
import { serverInvite, serverMember, server } from "@family-times-new/db/schema/app";
import { eq, and } from "@family-times-new/db/helpers";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../index";

// 招待コードに紛らわしい文字を入れないため、0/O/I/l などを抜いた文字セットを使います。
function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 招待 API です。
// create はログイン必須、validate は招待ページを開く前に使うため未ログインでも呼べる publicProcedure です。
export const invitesRouter = {
  // server のメンバーが招待コードを作成します。
  create: protectedProcedure
    .input(
      z.object({
        serverId: z.string(),
        expiresInHours: z.number().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // 招待を作れるのは、少なくともその server に参加しているユーザーだけです。
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

      const code = generateInviteCode();
      // expiresInHours が指定された場合だけ期限を設定します。
      const expiresAt = input.expiresInHours
        ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
        : null;

      await db.insert(serverInvite).values({
        id: crypto.randomUUID(),
        serverId: input.serverId,
        code,
        createdBy: userId,
        expiresAt,
      });

      return { code };
    }),

  // 招待リンク表示時に、コードが存在するか・期限切れでないかを確認します。
  // 参加ボタンを出す前の確認なので publicProcedure にしています。
  validate: publicProcedure
    .input(z.object({ code: z.string() }))
    .handler(async ({ input }) => {
      // server と join して、画面に表示する server 名・画像情報も一緒に返します。
      const invite = await db
        .select({
          id: serverInvite.id,
          code: serverInvite.code,
          serverId: serverInvite.serverId,
          expiresAt: serverInvite.expiresAt,
          serverName: server.name,
          serverPhotoId: server.photoId,
          serverPhotoExtension: server.photoExtension,
        })
        .from(serverInvite)
        .innerJoin(server, eq(serverInvite.serverId, server.id))
        .where(eq(serverInvite.code, input.code))
        .get();

      if (!invite) {
        return { valid: false as const, reason: "Invalid invite code" };
      }

      // Date 同士を比較して、期限を過ぎた招待を無効扱いにします。
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        return { valid: false as const, reason: "Invite has expired" };
      }

      return {
        valid: true as const,
        serverId: invite.serverId,
        serverName: invite.serverName,
        serverPhotoId: invite.serverPhotoId,
        serverPhotoExtension: invite.serverPhotoExtension,
      };
    }),
};
