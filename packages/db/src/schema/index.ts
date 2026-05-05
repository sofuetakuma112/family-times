// DB スキーマの入口です。
// Better Auth が使う認証系テーブルと、Family Times 固有のアプリ用テーブルを
// ここからまとめて export することで、packages/db/src/index.ts から一括で読み込めます。
export * from "./auth";
export * from "./app";
