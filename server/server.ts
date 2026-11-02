// 同期用 API サーバー（Cloudflare Workers で動かす）
// 手元: npm start（中身は wrangler dev）→ http://localhost:3000 。保存先は手元用の D1（.wrangler フォルダの中）
// 初めて動かす前と、server/migrations に SQL を足したあとは、npm run db:migrate で手元の D1 に表を作る
// 設定は wrangler.jsonc。型の間違い探しは npm run typecheck で行う
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// 受け取るデータの上限（128KB）。画面は素材のアイコンを送らないので、目標が多くても足りる大きさ
const MAX_BODY = 128 * 1024;

// 保存する同期コードの数の上限。だれでも送れるので、でたらめなコードで送られ続けてもデータベースが満杯にならないようにする
// 最大で 1,000 × 128KB ＝ 約 128MB（D1 の無料枠は 1 つのデータベースにつき 500MB）
const MAX_CODES = 1000;

// この日数のあいだ送られてこなかった同期コードは、毎日の掃除（下の scheduled）で消す
// 使わなくなったデータをサーバーに残さないため。消えると、MAX_CODES の枠も空く
const KEEP_DAYS = 180;

// このサーバーを呼んでよいページの場所（オリジン = プロトコル + ホスト名 + ポート番号）
// ブラウザは、別のオリジンのサーバーへの通信を、サーバーが許可したときだけ通す（CORS）
// 公開ページ（GitHub Pages）と、画面の開発用サーバー（npm run dev）。オリジンにはパス（/gbf-tracker/）は含まない
const ALLOWED_ORIGINS = ['https://syugo1142.github.io', 'http://localhost:5173'];

// 同期コード: パソコンとスマホで同じデータを使うための合言葉
// 知られると読み書きされてしまうので、推測できない長さ（英数字と - _ だけの 32〜64 文字）に限る
const CODE_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

// Workers では、メモリの中身はリクエストのたびに消えることがある。そのため保存は D1 に行う
// Env は wrangler.jsonc から wrangler types で作った型（server/worker-configuration.d.ts）。DB が D1 を指す
const app = new Hono<{ Bindings: Env }>();

// 届いたリクエストをターミナルに表示する
app.use(logger());

// 暗号化されない http:// のリクエストは断る（同期コードとデータが、途中で盗み見られないようにするため）
// https:// に転送（リダイレクト）はしない。転送しても、最初のリクエストで同期コードはもう流れてしまっているため
// 手元（npm start）は http://localhost で動かすので、localhost と 127.0.0.1 だけは通す
app.use(async (c, next) => {
  const url = new URL(c.req.url);
  if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    return c.json({ error: 'https required' }, 400);
  }
  await next();
});

// /api/ で始まるリクエストに、CORS の許可の返事を付ける
// PUT・DELETE や JSON を送るときは、ブラウザが先に OPTIONS で「送ってよいか」を聞いてくる（プリフライト）。それにもここで答える
app.use(
  '/api/*',
  cors({
    origin: ALLOWED_ORIGINS,
    allowMethods: ['GET', 'PUT', 'DELETE'],
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
  // （大きな JSON を読み直すと計算に時間がかかり、無料枠の上限 10 ミリ秒を超えるおそれがあるため）
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
    const code = c.req.param('code');
    // 新しい同期コードのときだけ、保存してある数を数え、上限に達していたら 503（今は受け付けられない）で断る
    // 今あるコードの上書きは、上限に達していても受け付ける
    // （同時に送られると上限を少し超えることがあるが、満杯を防ぐ目的には十分）
    const exists = await c.env.DB.prepare('SELECT 1 FROM sync WHERE code = ?').bind(code).first();
    if (!exists) {
      const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM sync').first<number>('n');
      if ((count ?? 0) >= MAX_CODES) return c.json({ error: 'full' }, 503);
    }
    const updatedAt = new Date().toISOString();
    // その同期コードの行がなければ足し（INSERT）、あれば中身を書き換える（ON CONFLICT ... DO UPDATE）
    // excluded は「足そうとした行」を指す
    await c.env.DB
      .prepare(
        `INSERT INTO sync (code, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (code) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .bind(code, text, updatedAt)
      .run();
    return c.json({ updatedAt });
  },
);

// 保存してあるデータを消す（使う人が、自分のデータをサーバーに残したくないとき）
app.delete('/api/sync/:code', async (c) => {
  const result = await c.env.DB.prepare('DELETE FROM sync WHERE code = ?').bind(c.req.param('code')).run();
  // meta.changes は、消した行の数。0 なら、その同期コードのデータはもともとなかった
  if (result.meta.changes === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ deleted: true });
});

// メニューにないリクエストには 404 を返す
app.notFound((c) => c.json({ error: 'not found' }, 404));

// 思わぬエラー（D1 につながらないなど）のときは、中身を見せずに 500（サーバーの間違い）を返す。詳しいことはログに出す
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'server error' }, 500);
});

// Workers は、ここで渡したものを呼んでくれる。待つ番号（ポート）は Cloudflare が決める
// fetch: リクエストが届いたとき（中身は Hono の app）
// scheduled: wrangler.jsonc の triggers.crons に書いた時間になったとき（Cron Triggers）
export default {
  fetch: app.fetch,
  async scheduled(controller, env) {
    // scheduledTime は、動くはずだった時間（1970 年からのミリ秒）。そこから KEEP_DAYS 日前より古いものを消す
    // updated_at は同じ形の ISO 形式（2026-11-02T03:04:05.000Z）なので、文字列のまま大きさを比べられる
    const before = new Date(controller.scheduledTime - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const result = await env.DB.prepare('DELETE FROM sync WHERE updated_at < ?').bind(before).run();
    console.log(`${before} より前に送られた同期コードを ${result.meta.changes} 件消しました`);
  },
} satisfies ExportedHandler<Env>;
