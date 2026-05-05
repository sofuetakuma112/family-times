// ============================================================
// oRPC ルーター - 画像アップロード
// ============================================================
// 画像アップロード用の署名付きURL（Presigned URL）を取得する API。
//
// ■ Presigned URL とは？
//   S3等のストレージに直接ファイルをアップロードするための一時的なURLです。
//   サーバーを経由せずにクライアントから直接ストレージにアップロードできるため、
//   サーバーの負荷を軽減できます。
//
// ■ アップロードの流れ:
//   1. クライアント → upload.getPresignedUrl() を呼ぶ
//   2. サーバー → S3なら署名付きURL / ローカルならトークン付きURLを返す
//   3. クライアント → 返されたURLに PUT リクエストで画像を直接アップロード
//
// ■ 依存性注入パターン:
//   _createUploadToken や _getS3PresignedUrl は外部から注入される関数です。
//   これにより、このファイル自体はサーバー固有の実装に依存しません。
//   （packages/api は純粋なロジック層、実装は apps/server 側で注入）
// ============================================================

import { env } from "@family-times-new/env/server";
import { z } from "zod";

import { protectedProcedure } from "../index";

// 外部から注入される関数（apps/server/src/index.ts で setUploadTokenCreator() 経由でセット）
let _createUploadToken: ((key: string) => string) | null = null;
let _getS3PresignedUrl: ((key: string, contentType: string) => Promise<string>) | null = null;

/** ローカルアップロード用トークン生成関数を外部から注入する */
export function setUploadTokenCreator(fn: (key: string) => string) {
  _createUploadToken = fn;
}

/** S3 署名付きURL生成関数を外部から注入する */
export function setS3PresignedUrlGetter(fn: (key: string, contentType: string) => Promise<string>) {
  _getS3PresignedUrl = fn;
}

// セキュリティ: 許可する画像ファイルの拡張子
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif", "heic"];

export const uploadRouter = {
  // ─── 署名付きURL取得 ─────────────────────────────────────
  getPresignedUrl: protectedProcedure
    .input(
      z.object({
        photoId: z.string(),      // 画像のユニークID（クライアントが生成）
        extension: z.string(),     // ファイル拡張子（jpg, png 等）
        path: z.string(),          // 保存先パス（例: "servers/{id}/channels/{id}/messages"）
        contentType: z.string(),   // MIMEタイプ（例: "image/jpeg"）
      }),
    )
    .handler(async ({ input }) => {
      // セキュリティチェック: 拡張子のホワイトリスト
      if (!ALLOWED_EXTENSIONS.includes(input.extension.toLowerCase())) {
        throw new Error("Invalid file extension");
      }
      // パストラバーサル攻撃の防止（"../" で上位ディレクトリにアクセスされるのを防ぐ）
      if (input.path.includes("..") || input.photoId.includes("..") || input.photoId.includes("/")) {
        throw new Error("Invalid path");
      }

      const key = `${input.path}/${input.photoId}.${input.extension}`;

      // S3 モード: S3互換ストレージが設定されている場合
      if (env.S3_ENDPOINT && _getS3PresignedUrl) {
        const url = await _getS3PresignedUrl(key, input.contentType);
        return { uploadUrl: url, key, photoId: input.photoId };
      }

      // ローカルモード: S3未設定の場合、サーバーのローカルファイルシステムに保存
      const token = _createUploadToken?.(key) ?? "";
      return {
        uploadUrl: `${env.BETTER_AUTH_URL}/api/upload/local/${key}?token=${token}`,
        key,
        photoId: input.photoId,
      };
    }),

  // ─── 画像URL取得 ─────────────────────────────────────────
  // 保存済み画像の表示用URLを返す
  getImageUrl: protectedProcedure
    .input(
      z.object({
        photoId: z.string(),
        extension: z.string(),
        path: z.string(),
      }),
    )
    .handler(async ({ input }) => {
      const key = `${input.path}/${input.photoId}.${input.extension}`;
      return { url: `${env.BETTER_AUTH_URL}/api/images/${key}` };
    }),
};
