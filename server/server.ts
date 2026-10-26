// 同期用 API サーバー（今は動作確認用の hello だけ）
// 起動: npm start（中身は node server/server.ts）→ http://localhost:3000/api/hello
// Node.js 24 は .ts の型の部分を取り除いて、そのまま実行する。型の間違い探しは npm run typecheck で行う
import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

const PORT = 3000;

// JSON を返す。status は HTTP のステータスコード（200 は成功、404 は見つからない）
// body は何でも入れられるように unknown（中身の分からない値）にしている
function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// リクエストが来るたびに、この関数が呼ばれる
// req: 届いたリクエスト（メソッド、URL、ヘッダーなど）
// res: これから返すレスポンス（ここに書き込んで返す）
const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  console.log(req.method, req.url); // 届いたリクエストをターミナルに表示する

  if (req.method === 'GET' && req.url === '/api/hello') {
    sendJson(res, 200, { message: 'hello' });
    return;
  }

  // メニューにないリクエストには 404 を返す
  sendJson(res, 404, { error: 'not found' });
});

// 3000番の窓口で、リクエストを待ち始める
server.listen(PORT, () => {
  console.log(`http://localhost:${PORT} で待っています（止めるときは Ctrl + C）`);
});
