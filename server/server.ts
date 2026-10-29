// 同期用 API サーバー
// 起動: npm start（中身は node server/server.ts）→ http://localhost:3000
// Node.js 24 は .ts の型の部分を取り除いて、そのまま実行する。型の間違い探しは npm run typecheck で行う
// Hono で書いている。Hono は Node.js でも Cloudflare Workers でも同じ書き方で動くので、あとで Workers に載せ換えやすい
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';

const PORT = 3000;
const MAX_BODY = 1024 * 1024; // 受け取るデータの上限（1MB）。アイコンの画像を含めても足りる大きさ

// 同期コード: パソコンとスマホで同じデータを使うための合言葉
// 知られると読み書きされてしまうので、推測できない長さ（英数字と - _ だけの 32〜64 文字）に限る
const CODE_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

// 保存したデータと、保存した日時
type Saved = { data: unknown; updatedAt: string };

// 保存場所。今はメモリなので、サーバーを止めると消える。あとでデータベース（D1）に置き換える
const store = new Map<string, Saved>();

const app = new Hono();

// 届いたリクエストをターミナルに表示する
app.use(logger());

app.get('/api/hello', (c) => c.json({ message: 'hello' }));

// /api/sync/ で始まるリクエストは、先に同期コードの形を確かめる。形が違えば 400（リクエストの間違い）を返す
app.use('/api/sync/:code', async (c, next) => {
  if (!CODE_PATTERN.test(c.req.param('code'))) {
    return c.json({ error: 'invalid code' }, 400);
  }
  await next();
});

// 保存してあるデータを返す
app.get('/api/sync/:code', (c) => {
  const saved = store.get(c.req.param('code'));
  if (!saved) return c.json({ error: 'not found' }, 404);
  return c.json(saved);
});

// 送られてきたデータを保存する（前のデータは上書き）
app.put(
  '/api/sync/:code',
  // 大きすぎるデータは読む前に断る。413 は「大きすぎる」のステータスコード
  bodyLimit({ maxSize: MAX_BODY, onError: (c) => c.json({ error: 'too large' }, 413) }),
  async (c) => {
    let data: unknown;
    try {
      data = await c.req.json();
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    // 画面の保存データはオブジェクト（{ ... }）なので、それ以外は断る
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return c.json({ error: 'invalid data' }, 400);
    }
    const saved: Saved = { data, updatedAt: new Date().toISOString() };
    store.set(c.req.param('code'), saved);
    return c.json({ updatedAt: saved.updatedAt });
  },
);

// メニューにないリクエストには 404 を返す
app.notFound((c) => c.json({ error: 'not found' }, 404));

// 3000番の窓口で、リクエストを待ち始める
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`http://localhost:${PORT} で待っています（止めるときは Ctrl + C）`);
});
