import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
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

export const channelRelations = relations(channel, ({ one }) => ({
  server: one(server, {
    fields: [channel.serverId],
    references: [server.id],
  }),
  creator: one(user, {
    fields: [channel.createdBy],
    references: [user.id],
  }),
}));
