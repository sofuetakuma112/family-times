import { relations, sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

// Family Times 固有のテーブル定義です。
// sqliteTable は「DB に保存する箱の形」を定義し、relations はテーブル同士のつながりを
// TypeScript からたどれるようにする設定です。

// ─── Servers ─────────────────────────────────────────────

// server は家族・グループ単位のまとまりです。
// Discord/Slack の「ワークスペース」に近く、チャンネル・メンバー・招待を配下に持ちます。
export const server = sqliteTable("server", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  photoId: text("photo_id"),
  photoExtension: text("photo_extension"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  // timestamp_ms は JavaScript の Date と相性がよいミリ秒の時刻として保存します。
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});

// relations により、server から members/channels/invites/creator を関連データとして取得できます。
export const serverRelations = relations(server, ({ many, one }) => ({
  members: many(serverMember),
  channels: many(channel),
  invites: many(serverInvite),
  creator: one(user, {
    fields: [server.createdBy],
    references: [user.id],
  }),
}));

// ─── Server Members ──────────────────────────────────────

// serverMember は「どのユーザーがどの server に参加しているか」を表す中間テーブルです。
// role は owner/admin/member などの権限判定に使います。
export const serverMember = sqliteTable(
  "server_member",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id")
      .notNull()
      // server が削除されたら、その server への参加情報も一緒に消します。
      .references(() => server.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      // user が削除されたら、そのユーザーの参加情報も一緒に消します。
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    // 同じユーザーが同じ server に二重参加できないようにします。
    uniqueIndex("server_member_unique").on(table.serverId, table.userId),
    // 「このユーザーが参加している server 一覧」を速く探すための index です。
    index("server_member_userId_idx").on(table.userId),
  ],
);

export const serverMemberRelations = relations(serverMember, ({ one }) => ({
  server: one(server, {
    fields: [serverMember.serverId],
    references: [server.id],
  }),
  user: one(user, {
    fields: [serverMember.userId],
    references: [user.id],
  }),
}));

// ─── Server Invites ──────────────────────────────────────

// serverInvite は招待リンクのコードを保存します。
// code が URL に含まれ、参加時にこのテーブルを見て有効な招待か確認します。
export const serverInvite = sqliteTable(
  "server_invite",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    // null の場合は期限なし、値がある場合はこの時刻を過ぎると無効です。
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    // 何回使われたかを記録します。将来、使用回数制限を入れる時にも使えます。
    uses: integer("uses").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("server_invite_serverId_idx").on(table.serverId)],
);

export const serverInviteRelations = relations(serverInvite, ({ one }) => ({
  server: one(server, {
    fields: [serverInvite.serverId],
    references: [server.id],
  }),
  creator: one(user, {
    fields: [serverInvite.createdBy],
    references: [user.id],
  }),
}));

// ─── Channels ────────────────────────────────────────────

// channel は server の中に作る会話スペースです。
// message は必ずどれか 1 つの channel に属します。
export const channel = sqliteTable(
  "channel",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    channelName: text("channel_name").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("channel_serverId_idx").on(table.serverId)],
);

export const channelRelations = relations(channel, ({ one, many }) => ({
  server: one(server, {
    fields: [channel.serverId],
    references: [server.id],
  }),
  messages: many(message),
  creator: one(user, {
    fields: [channel.createdBy],
    references: [user.id],
  }),
}));

// ─── Messages ────────────────────────────────────────────

// message はチャット投稿です。
// テキストだけでなく、画像、位置情報、返信先も同じレコードに保存します。
export const message = sqliteTable(
  "message",
  {
    id: text("id").primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channel.id, { onDelete: "cascade" }),
    serverId: text("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    message: text("message"),
    photoId: text("photo_id"),
    photoExtension: text("photo_extension"),
    imageWidth: integer("image_width"),
    imageHeight: integer("image_height"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    // 自分自身と同じ message テーブルを指すことで、返信スレッドを表現します。
    replyToId: text("reply_to_id"),
    isEdited: integer("is_edited", { mode: "boolean" }).default(false).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    // チャンネル内のメッセージを時刻順に読む処理が多いため、複合 index を張ります。
    index("message_channelId_createdAt_idx").on(
      table.channelId,
      table.createdAt,
    ),
    // server 単位でメッセージを探す処理用の index です。
    index("message_serverId_idx").on(table.serverId),
  ],
);

export const messageRelations = relations(message, ({ one, many }) => ({
  channel: one(channel, {
    fields: [message.channelId],
    references: [channel.id],
  }),
  server: one(server, {
    fields: [message.serverId],
    references: [server.id],
  }),
  author: one(user, {
    fields: [message.userId],
    references: [user.id],
  }),
  replyTo: one(message, {
    fields: [message.replyToId],
    references: [message.id],
    // 同じ message テーブル同士の関連が複数あるため、名前を付けて区別します。
    relationName: "reply",
  }),
  replies: many(message, { relationName: "reply" }),
  reactions: many(reaction),
}));

// ─── Reactions ───────────────────────────────────────────

// reaction はメッセージへの絵文字リアクションです。
// 1 ユーザーが同じメッセージに同じ絵文字を重複して付けないようにします。
export const reaction = sqliteTable(
  "reaction",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    // messageId + userId + emoji の組み合わせを一意にして、重複リアクションを防ぎます。
    uniqueIndex("reaction_unique").on(
      table.messageId,
      table.userId,
      table.emoji,
    ),
    index("reaction_messageId_idx").on(table.messageId),
  ],
);

export const reactionRelations = relations(reaction, ({ one }) => ({
  message: one(message, {
    fields: [reaction.messageId],
    references: [message.id],
  }),
  user: one(user, {
    fields: [reaction.userId],
    references: [user.id],
  }),
}));

// ─── Push Subscriptions ──────────────────────────────────

// pushSubscription はブラウザの Web Push 通知に必要な購読情報です。
// endpoint/p256dh/auth はブラウザが発行する値で、サーバーが通知を送る時に使います。
export const pushSubscription = sqliteTable(
  "push_subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    deviceInfo: text("device_info"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("push_subscription_userId_idx").on(table.userId)],
);

export const pushSubscriptionRelations = relations(
  pushSubscription,
  ({ one }) => ({
    user: one(user, {
      fields: [pushSubscription.userId],
      references: [user.id],
    }),
  }),
);
