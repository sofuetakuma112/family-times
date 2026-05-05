# Family Times

Discord風の家族チャットPWA。リアルタイムメッセージング、画像共有、位置情報共有、プッシュ通知をサポート。

## Tech Stack

| レイヤー | 技術 |
|---------|------|
| フレームワーク | TanStack Start (SSR + React 19) |
| API | oRPC (型安全RPC) + TanStack Query |
| バックエンド | Hono |
| ランタイム | Bun |
| DB | SQLite + Drizzle ORM (libSQL) |
| 認証 | Better Auth (Google OAuth / Email) |
| リアルタイム | Bun WebSocket |
| ストレージ | S3互換 (開発時はローカルファイル) |
| 通知 | Web Push API (VAPID) |
| モノレポ | Turborepo |
| UI | Tailwind CSS v4 + shadcn/ui |

## Getting Started

```bash
bun install
```

### 環境変数

`apps/server/.env`:

```env
BETTER_AUTH_SECRET=<32文字以上のシークレット>
BETTER_AUTH_URL=http://localhost:3002
CORS_ORIGIN=http://localhost:3001
DATABASE_URL=file:../../local.db

# Google OAuth (任意)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Push通知 (任意 - 生成方法は後述)
VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
VAPID_SUBJECT=mailto:your@email.com

# S3ストレージ (未設定時はローカルファイル保存)
# S3_ENDPOINT=http://localhost:9000
# S3_REGION=auto
# S3_BUCKET=family-times
# S3_ACCESS_KEY_ID=<key>
# S3_SECRET_ACCESS_KEY=<secret>
```

`apps/web/.env`:

```env
VITE_SERVER_URL=http://localhost:3002
# VITE_MAPBOX_TOKEN=<mapbox-token>  # 任意: 地図表示用
```

### VAPID鍵の生成

```bash
cd apps/server && bun -e "const wp = require('web-push'); const k = wp.generateVAPIDKeys(); console.log('VAPID_PUBLIC_KEY=' + k.publicKey); console.log('VAPID_PRIVATE_KEY=' + k.privateKey);"
```

### データベースセットアップ

```bash
bun run db:push
```

### 開発サーバー起動

```bash
bun run dev
```

- Web: http://localhost:3001
- API: http://localhost:3002
- WebSocket: ws://localhost:3002/ws

## Project Structure

```
family-times-new/
├── apps/
│   ├── web/                    # TanStack Start フロントエンド
│   │   ├── src/
│   │   │   ├── routes/         # ファイルベースルーティング
│   │   │   │   ├── __root.tsx
│   │   │   │   ├── index.tsx         # メインチャット画面
│   │   │   │   ├── login.tsx         # ログイン/登録
│   │   │   │   ├── profile.tsx       # プロフィール設定
│   │   │   │   └── invite/           # 招待コード処理
│   │   │   ├── components/
│   │   │   │   ├── app-shell.tsx     # メインレイアウト
│   │   │   │   ├── chat/            # チャット関連
│   │   │   │   └── sidebar/         # サイドバー
│   │   │   └── hooks/
│   │   │       ├── use-websocket.ts  # WebSocket接続管理
│   │   │       └── use-push-notifications.ts
│   │   └── public/
│   │       ├── manifest.json   # PWAマニフェスト
│   │       └── sw.js           # Service Worker
│   └── server/                 # Hono バックエンド
│       └── src/
│           ├── index.ts        # エントリポイント + WebSocket
│           ├── ws.ts           # WebSocketルーム管理
│           └── lib/
│               ├── storage.ts  # S3/ローカルストレージ
│               └── push.ts     # Web Push通知
├── packages/
│   ├── api/                    # oRPC ルーター定義
│   │   └── src/routers/
│   │       ├── servers.ts      # サーバーCRUD
│   │       ├── channels.ts     # チャンネルCRUD
│   │       ├── messages.ts     # メッセージ送受信
│   │       ├── invites.ts      # 招待コード
│   │       ├── upload.ts       # 画像アップロード
│   │       ├── push.ts         # Push購読管理
│   │       └── users.ts        # プロフィール
│   ├── auth/                   # Better Auth設定
│   ├── db/                     # Drizzle スキーマ
│   │   └── src/schema/
│   │       ├── auth.ts         # user, session, account, verification
│   │       └── app.ts          # server, channel, message, reaction, etc.
│   ├── env/                    # 型安全な環境変数
│   ├── ui/                     # shadcn/ui 共有コンポーネント (18個)
│   └── config/                 # 共有TypeScript設定
├── turbo.json
└── package.json
```

## Features

### Core
- サーバー作成・参加・招待コード
- チャンネル作成・切り替え
- リアルタイムメッセージング (WebSocket)
- メッセージリアクション (絵文字)
- メッセージリプライ

### Media
- 画像アップロード・表示 (S3互換/ローカル)
- 位置情報共有 (Mapbox/OpenStreetMap)

### Platform
- PWA (インストール可能、オフライン対応)
- Web Push通知 (VAPID)
- Google OAuth + Email/Password認証
- レスポンシブUI (モバイル対応サイドバー)

## Database Schema

11テーブル: `user`, `session`, `account`, `verification`, `server`, `server_member`, `server_invite`, `channel`, `message`, `reaction`, `push_subscription`

```bash
bun run db:studio   # Drizzle Studio でDB確認
```

## Available Scripts

| コマンド | 説明 |
|---------|------|
| `bun run dev` | 全アプリ開発サーバー起動 |
| `bun run build` | 全アプリビルド |
| `bun run check-types` | TypeScript型チェック |
| `bun run dev:web` | Webのみ起動 |
| `bun run dev:server` | サーバーのみ起動 |
| `bun run db:push` | スキーマをDBに反映 |
| `bun run db:studio` | Drizzle Studio起動 |
| `bun run db:generate` | マイグレーション生成 |
| `bun run db:migrate` | マイグレーション実行 |
