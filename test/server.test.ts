// 同期サーバー（server/server.ts）の自動テスト。npm test で動かす
// テストの道具は Node.js に入っている node:test と node:assert を使う（部品を増やさないため）
// サーバーは wrangler の createTestHarness で、本番と同じ Workers の仕組み（workerd）の上で動かす
// D1 はテスト用にその場で作られ、手元の開発用のデータ（.wrangler フォルダ）には触らない
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createTestHarness } from 'wrangler';

// テストで使う D1 の型。ここで使う機能（prepare・bind・run・first）だけを書く
type Env = {
  DB: {
    prepare(sql: string): {
      bind(...values: unknown[]): {
        run(): Promise<unknown>;
        first<T>(column?: string): Promise<T | null>;
      };
      first<T>(column?: string): Promise<T | null>;
    };
  };
};

const server = createTestHarness({ workers: [{ configPath: './wrangler.jsonc' }] });
// リクエストは worker.fetch で送る。server.fetch は中で http に中継するので、https の URL もサーバーには http で届いてしまう
const worker = server.getWorker<Env>();
let env: Env;

// 画面と同じ作り方（でたらめな 32 バイトを base64url にした 43 文字）で同期コードを作る
function newCode(): string {
  return randomBytes(32).toString('base64url');
}

// 同期の API に送る。/ で始まる URL は、手元のテスト用サーバー（http://127.0.0.1:番号）に送られる
// 127.0.0.1 は手元なので、http を断る仕組みには当たらない
// init はテストで使う形（メソッド・ヘッダー・文字の本文）だけにする（Node.js の RequestInit 型は、テストの道具の型と合わないため）
function sync(code: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
  return worker.fetch(`/api/sync/${code}`, init);
}

function put(code: string, body: string) {
  return sync(code, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
}

// すべてのテストの前に1回だけ: サーバーを起動し、D1 に表を作る（server/migrations の SQL を当てる）
before(async () => {
  await server.listen();
  await worker.applyD1Migrations('DB');
  env = await worker.getEnv();
});

// テストごとに表を空にする。前のテストのデータが、次のテストの結果に混ざらないようにするため
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM sync').bind().run();
});

// すべてのテストが終わったら、サーバーを止める（止めないと、テストが終わらない）
after(async () => {
  await server.close();
});

describe('保存と取り出し', () => {
  test('送ったデータを、同じ同期コードで取ってこられる', async () => {
    const code = newCode();
    const data = { goals: [{ name: '十天衆' }], owned: { 'ダマスカス骸晶': 3 } };

    const res = await put(code, JSON.stringify(data));
    assert.equal(res.status, 200);
    const { updatedAt } = (await res.json()) as { updatedAt: string };

    const got = await sync(code);
    assert.equal(got.status, 200);
    assert.deepEqual(await got.json(), { data, updatedAt });
  });

  test('同じ同期コードで送り直すと、上書きされる', async () => {
    const code = newCode();
    await put(code, '{"n":1}');
    await put(code, '{"n":2}');

    const res = await sync(code);
    const got = (await res.json()) as { data: unknown };
    assert.deepEqual(got.data, { n: 2 });
  });

  test('まだ送っていない同期コードは 404', async () => {
    const res = await sync(newCode());
    assert.equal(res.status, 404);
  });

  test('SQL のような文字が入っていても、ただの文字として保存される（SQL インジェクション対策）', async () => {
    const code = newCode();
    const data = { memo: "'); DROP TABLE sync; --" };
    await put(code, JSON.stringify(data));

    const res = await sync(code);
    const got = (await res.json()) as { data: unknown };
    assert.deepEqual(got.data, data);
    // 表が消えていないことを確かめる
    const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM sync').first<number>('n');
    assert.equal(count, 1);
  });
});

describe('断る場合', () => {
  test('同期コードの形が違うと 400（短すぎる・使えない文字）', async () => {
    assert.equal((await sync('short')).status, 400);
    assert.equal((await sync('a'.repeat(42) + '!')).status, 400);
  });

  test('JSON でないデータは 400', async () => {
    const res = await put(newCode(), 'これは JSON ではない');
    assert.equal(res.status, 400);
  });

  test('オブジェクトでない JSON（配列・数・null）は 400', async () => {
    for (const body of ['[1,2]', '123', 'null']) {
      const res = await put(newCode(), body);
      assert.equal(res.status, 400, body);
    }
  });

  test('128KB を超えるデータは 413 で、保存されない', async () => {
    const code = newCode();
    const res = await put(code, JSON.stringify({ big: 'a'.repeat(128 * 1024) }));
    assert.equal(res.status, 413);
    assert.equal((await sync(code)).status, 404);
  });

  test('128KB ちょうどまでは受け付ける', async () => {
    const head = '{"big":"';
    const tail = '"}';
    const body = head + 'a'.repeat(128 * 1024 - head.length - tail.length) + tail;
    const res = await put(newCode(), body);
    assert.equal(res.status, 200);
  });

  test('localhost 以外への http のリクエストは 400、https なら通る', async () => {
    const http = await worker.fetch('http://gbf-tracker-sync.example.com/api/hello');
    assert.equal(http.status, 400);
    const https = await worker.fetch('https://gbf-tracker-sync.example.com/api/hello');
    assert.equal(https.status, 200);
  });

  test('メニューにない場所は 404', async () => {
    const res = await worker.fetch('/api/nothing');
    assert.equal(res.status, 404);
  });
});

describe('保存する数の上限（1,000 件）', () => {
  // 1,000 件を API で送ると時間がかかるので、D1 に直接入れる
  async function fill(n: number): Promise<string[]> {
    const codes = Array.from({ length: n }, () => newCode());
    const now = new Date().toISOString();
    // 何件かずつ、1回の SQL でまとめて入れる。値は ? と bind で渡す
    // D1 は1つの SQL で渡せる値の数に上限（100 個）があるので、30 件（1件に3つで 90 個）ずつにする
    for (let i = 0; i < codes.length; i += 30) {
      const part = codes.slice(i, i + 30);
      await env.DB
        .prepare(`INSERT INTO sync (code, data, updated_at) VALUES ${part.map(() => '(?, ?, ?)').join(', ')}`)
        .bind(...part.flatMap((c) => [c, '{}', now]))
        .run();
    }
    return codes;
  }

  test('1,000 件あると、新しい同期コードは 503 で断る', async () => {
    await fill(1000);
    const res = await put(newCode(), '{}');
    assert.equal(res.status, 503);
  });

  test('1,000 件あっても、今ある同期コードの上書きは受け付ける', async () => {
    const [code] = await fill(1000);
    const res = await put(code, '{"n":1}');
    assert.equal(res.status, 200);
  });

  test('999 件なら、新しい同期コードも受け付ける', async () => {
    await fill(999);
    const res = await put(newCode(), '{}');
    assert.equal(res.status, 200);
  });
});

describe('消す', () => {
  test('消すと 200、そのあと取ってくると 404', async () => {
    const code = newCode();
    await put(code, '{}');

    const res = await sync(code, { method: 'DELETE' });
    assert.equal(res.status, 200);
    assert.equal((await sync(code)).status, 404);
  });

  test('もともとない同期コードを消すと 404', async () => {
    const res = await sync(newCode(), { method: 'DELETE' });
    assert.equal(res.status, 404);
  });
});

describe('CORS（呼んでよいページ）', () => {
  test('公開ページからは許可の返事が付く', async () => {
    const res = await worker.fetch('/api/hello', { headers: { Origin: 'https://syugo1142.github.io' } });
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://syugo1142.github.io');
  });

  test('ほかのページからは許可の返事が付かない', async () => {
    const res = await worker.fetch('/api/hello', { headers: { Origin: 'https://example.com' } });
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
  });

  test('PUT の前の問い合わせ（プリフライト）に、PUT してよいと答える', async () => {
    const res = await sync(newCode(), {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://syugo1142.github.io',
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('Access-Control-Allow-Methods') ?? '', /PUT/);
  });
});

describe('毎日の掃除（Cron Triggers）', () => {
  test('180日より前に送られたデータだけを消す', async () => {
    const now = new Date('2026-11-06T18:00:00.000Z');
    const day = 24 * 60 * 60 * 1000;
    const old = newCode();
    const recent = newCode();
    const insert = 'INSERT INTO sync (code, data, updated_at) VALUES (?, ?, ?)';
    await env.DB.prepare(insert).bind(old, '{}', new Date(now.getTime() - 181 * day).toISOString()).run();
    await env.DB.prepare(insert).bind(recent, '{}', new Date(now.getTime() - 179 * day).toISOString()).run();

    // 掃除を、決まった時刻に動いたことにして呼ぶ
    const result = await worker.scheduled({ cron: '0 18 * * *', scheduledTime: now });
    assert.equal(result.outcome, 'ok');

    assert.equal((await sync(old)).status, 404);
    assert.equal((await sync(recent)).status, 200);
  });
});
