import { env } from "@family-times-new/env/server";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

// アプリ全体で使う Drizzle ORM の接続口です。
// 初心者向けに言うと、ここで「SQLite/Turso に接続する client」と
// 「TypeScript で扱えるテーブル定義 schema」を結びつけています。
export function createDb() {
  // DATABASE_URL は apps/server/.env などで設定します。
  // createClient は libSQL/Turso 用の低レベルなデータベース接続を作ります。
  const client = createClient({
    url: env.DATABASE_URL,
  });

  // drizzle に schema を渡すことで、db.query.user.findMany() のような
  // 型安全なクエリ API が使えるようになります。
  return drizzle({ client, schema });
}

// 多くのファイルではこの db を import して使います。
// テストなどで別 DB を差し替えたい場合に備えて、上では createDb() も export しています。
export const db = createDb();
