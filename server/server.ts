// 同期用 API サーバー（Cloudflare Workers で動かす）
// 手元: npm start（中身は wrangler dev）→ http://localhost:3000 。保存先は手元用の D1（.wrangler フォルダの中）
// 初めて動かす前と、server/migrations に SQL を足したあとは、npm run db:migrate で手元の D1 に表を作る
// 設定は wrangler.jsonc。型の間違い探しは npm run typecheck で行う
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const MAX_BODY = 1024 * 1024; // 受け取るデータの上限（1MB）。アイコンの画像を含めても足りる大きさ

// このサーバーを呼んでよいページの場所（オリジン = プロトコル + ホスト名 + ポート番号）
// ブラウザは、別のオリジンのサーバーへの通信を、サーバーが許可したときだけ通す（CORS）
// 今は画面の開発用サーバー（npm run dev）だけ。公開ページからつなぐときに、公開ページのオリジンを足す
const ALLOWED_ORIGINS = ['http://localhost:5173'];

// 同期コード: パソコンとスマホで同じデータを使うための合言葉
// 知られると読み書きされてしまうので、推測できない長さ（英数字と - _ だけの 32〜64 文字）に限る
const CODE_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

// Workers では、メモリの中身はリクエストのたびに消えることがある。そのため保存は D1 に行う
// Env は wrangler.jsonc から wrangler types で作った型（server/worker-configuration.d.ts）。DB が D1 を指す
const app = new Hono<{ Bindings: Env }>();

// 届いたリクエストをターミナルに表示する
app.use(logger());

// /api/ で始まるリクエストに、CORS の許可の返事を付ける
// PUT や JSON を送るときは、ブラウザが先に OPTIONS で「送ってよいか」を聞いてくる（プリフライト）。それにもここで答える
app.use(
  '/api/*',
  cors({
    origin: ALLOWED_ORIGINS,
    allowMethods: ['GET', 'PUT'],
    allowHeaders: ['Content-Type'],
  }),
);

app.get('/api/hello', (c) => c.json({ message: 'hello' }));

// /api/sync/ で始まるリクエストは、先に同期コードの形を確かめる。形が違えば 400（リクエストの間違い）を返す
app.use('/api/sync/:code', async (c, next) => {
  if (!CODE_PATTERN.test(c.req.param('code'))) {
    return c.json({ error: 'invalid code' }, 400);
  }
  await next();
});

// 保存してあるデータを返す
app.get('/api/sync/:code', async (c) => {
  // ? の場所に bind の値が入る。値を SQL の文に直接つなげないので、変な値が来ても SQL として実行されない（SQL インジェクション対策）
  const row = await c.env.DB
    .prepare('SELECT data, updated_at FROM sync WHERE code = ?')
    .bind(c.req.param('code'))
    .first<{ data: string; updated_at: string }>();
  if (!row) return c.json({ error: 'not found' }, 404);
  // data は保存するときに JSON か確かめた文字列なので、読み直さずにそのまま返事に入れる
  // （1MB の JSON を読み直すと計算に時間がかかり、無料枠の上限 10 ミリ秒を超えるおそれがあるため）
  return c.body(`{"data":${row.data},"updatedAt":${JSON.stringify(row.updated_at)}}`, 200, {
    'Content-Type': 'application/json; charset=UTF-8',
  });
});

// 送られてきたデータを保存する（前のデータは上書き）
app.put(
  '/api/sync/:code',
  // 大きすぎるデータは読む前に断る。413 は「大きすぎる」のステータスコード
  bodyLimit({ maxSize: MAX_BODY, onError: (c) => c.json({ error: 'too large' }, 413) }),
  async (c) => {
    const text = await c.req.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return c.json({ error: 'invalid json' }, 400);
    }
    // 画面の保存データはオブジェクト（{ ... }）なので、それ以外は断る
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return c.json({ error: 'invalid data' }, 400);
    }
    const updatedAt = new Date().toISOString();
    // その同期コードの行がなければ足し（INSERT）、あれば中身を書き換える（ON CONFLICT ... DO UPDATE）
    // excluded は「足そうとした行」を指す
    await c.env.DB
      .prepare(
        `INSERT INTO sync (code, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .bind(c.req.param('code'), text, updatedAt)
      .run();
    return c.json({ updatedAt });
  },
);

// メニューにないリクエストには 404 を返す
app.notFound((c) => c.json({ error: 'not found' }, 404));

// 思わぬエラー（D1 につながらないなど）のときは、中身を見せずに 500（サーバーの間違い）を返す。詳しいことはログに出す
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'server error' }, 500);
});

// Workers は、ここで渡した app にリクエストを届けてくれる。待つ番号（ポート）は Cloudflare が決める
export default app;
