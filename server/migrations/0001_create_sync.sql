-- 同期のデータを入れる表（テーブル）。同期コード1つにつき1行
-- このファイルを足したら、手元は npm run db:migrate、本物の D1 は npx wrangler d1 migrations apply DB --remote で表を作る
CREATE TABLE sync (
  code TEXT PRIMARY KEY,   -- 同期コード。PRIMARY KEY なので同じコードの行は1つだけで、コードで探すのも速い
  data TEXT NOT NULL,      -- 画面のデータ（JSON の文字列のまま入れる）
  updated_at TEXT NOT NULL -- 保存した日時（ISO 形式。例: 2026-11-02T07:06:21.000Z）
);
