// ============================================================
// アップロードトークン管理
// ============================================================
// ローカルファイルアップロード用の一時トークンを管理する。
//
// ■ なぜトークンが必要か？
//   ローカルアップロードは PUT /api/upload/local/{path} で行うが、
//   このエンドポイントは誰でもアクセスできてしまう。
//   そこで、短い有効期限（10分）のワンタイムトークンを発行し、
//   正当なアップロードリクエストのみ受け付ける。
//
// ■ フロー:
//   1. upload.getPresignedUrl() でトークンを生成
//   2. クライアントがトークン付きURLに PUT リクエスト
//   3. サーバーがトークンを検証（validateUploadToken）
//   4. 検証に成功したら1回限りでトークンを削除（ワンタイム）
// ============================================================

// インメモリの Map でトークンを管理（サーバー再起動でリセットされる）
const uploadTokens = new Map<string, { key: string; expires: number }>();

/**
 * アップロードトークンを生成する
 * @param key - アップロード先のファイルパス
 * @returns 生成されたトークン（UUID形式）
 */
export function createUploadToken(key: string): string {
  const token = crypto.randomUUID();
  // 600_000 ミリ秒 = 10分間有効
  uploadTokens.set(token, { key, expires: Date.now() + 600_000 });
  return token;
}

/**
 * アップロードトークンを検証する
 * @param token - 検証するトークン
 * @param key - 期待するファイルパス（トークン生成時のパスと一致するか確認）
 * @returns トークンが有効なら true
 *
 * ■ セキュリティ:
 *   - トークンは1回使うと削除される（リプレイ攻撃防止）
 *   - 有効期限を過ぎたトークンは無効
 *   - ファイルパスが一致しない場合も無効（別のファイルへの書き込みを防止）
 */
export function validateUploadToken(token: string, key: string): boolean {
  const entry = uploadTokens.get(token);
  if (!entry) return false;
  uploadTokens.delete(token); // ワンタイム: 使用後は即削除
  if (Date.now() > entry.expires) return false; // 期限切れチェック
  return entry.key === key; // パス一致チェック
}
