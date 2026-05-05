import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const server = sqliteTable("server", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  photoId: text("photo_id"),
  photoExtension: text("photo_extension"),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
});

export const serverMember = sqliteTable(
  "server_member",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id")
      .notNull()
      .references(() => server.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex("server_member_unique").on(table.serverId, table.userId),
    index("server_member_userId_idx").on(table.userId),
  ],
);

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
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    uses: integer("uses").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("server_invite_serverId_idx").on(table.serverId)],
);

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

export const serverRelations = relations(server, ({ many, one }) => ({
  members: many(serverMember),
  channels: many(channel),
  invites: many(serverInvite),
  creator: one(user, {
    fields: [server.createdBy],
    references: [user.id],
  }),
}));

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
    replyToId: text("reply_to_id"),
    isEdited: integer("is_edited", { mode: "boolean" }).default(false).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index("message_channelId_createdAt_idx").on(
      table.channelId,
      table.createdAt,
    ),
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
    relationName: "reply",
  }),
  replies: many(message, { relationName: "reply" }),
  reactions: many(reaction),
}));

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
