// ============================================================
// ブラウザ公開用の環境変数定義
// ============================================================
// このファイルは apps/web の React コンポーネントや hooks から使います。
// ブラウザに埋め込まれる値なので、秘密情報は絶対に入れません。
//
// Vite は VITE_ で始まる環境変数だけをクライアントへ公開します。
// clientPrefix: "VITE_" は、そのルールを型定義にも反映する設定です。
// ============================================================

import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    // API サーバーの URL。WebSocket URL もこの値から ws:// に変換して作る。
    VITE_SERVER_URL: z.url(),
    // 地図画像を Mapbox で表示する場合だけ設定。未設定なら OpenStreetMap リンクを表示。
    VITE_MAPBOX_TOKEN: z.string().optional(),
  },
  // import.meta.env は Vite がブラウザ向けに提供する環境変数。
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
