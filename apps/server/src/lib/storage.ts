// ============================================================
// S3 互換ストレージ - 画像ファイルの保存・取得
// ============================================================
// AWS S3 互換のオブジェクトストレージ（S3, R2, MinIO 等）を使った
// ファイルアップロード・ダウンロード機能。
//
// ■ Presigned URL（署名付きURL）とは？
//   有効期限付きの一時的なURLで、認証なしでS3にアクセスできる。
//   - アップロード用: クライアントが直接S3にファイルを PUT できる
//   - ダウンロード用: クライアントが直接S3からファイルを GET できる
//   → サーバーを経由しないので高速 & サーバー負荷が軽い
//
// ■ @aws-sdk/client-s3:
//   AWS公式のS3クライアント。S3互換サービス（Cloudflare R2, MinIO等）でも使える。
// ============================================================

import { env } from "@family-times-new/env/server";
import {
  S3Client,
  PutObjectCommand,   // ファイルアップロード用
  GetObjectCommand,    // ファイルダウンロード用
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 クライアントのシングルトン（初回アクセス時に作成）
let s3Client: S3Client | null = null;

/** S3 クライアントを取得する（遅延初期化パターン） */
function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
      },
      forcePathStyle: true, // MinIO / R2 では必須（バケット名をパスに含める形式）
    });
  }
  return s3Client;
}

/**
 * アップロード用の署名付きURLを生成する
 *
 * @param key - S3上のファイルパス（例: "servers/xxx/channels/yyy/messages/photo.jpg"）
 * @param contentType - MIMEタイプ（例: "image/jpeg"）
 * @param expiresIn - URL有効期限（秒）。デフォルト3600秒（1時間）
 * @returns 署名付きURL（クライアントがこのURLに PUT するとファイルがS3に保存される）
 */
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000", // 1年キャッシュ
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * ダウンロード用の署名付きURLを生成する
 *
 * @param key - S3上のファイルパス
 * @returns 署名付きURL（クライアントがこのURLに GET するとファイルを取得できる）
 */
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/** 画像のS3キー（ファイルパス）を生成する */
export function getImageKey(
  path: string,
  photoId: string,
  extension: string,
): string {
  return `${path}/${photoId}.${extension}`;
}

/** AVIF 形式の画像キーを生成する */
export function getAvifKey(path: string, photoId: string): string {
  return `${path}/${photoId}.avif`;
}
