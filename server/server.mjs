// 同期用 API サーバー（今は動作確認用の hello だけ）
// 起動: node server/server.mjs  → http://localhost:3000/api/hello
import http from 'node:http';

const PORT = 3000;

// リクエストが来るたびに、この関数が呼ばれる
// req: 届いたリクエスト（メソッド、URL、ヘッダーなど）
// res: これから返すレスポンス（ここに書き込んで返す）
const server = http.createServer((req, res) => {
  console.log(req.method, req.url); // 届いたリクエストをターミナルに表示する

  if (req.method === 'GET' && req.url === '/api/hello') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'hello' }));
    return;
  }

  // メニューにないリクエストには 404 を返す
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

// 3000番の窓口で、リクエストを待ち始める
server.listen(PORT, () => {
  console.log(`http://localhost:${PORT} で待っています（止めるときは Ctrl + C）`);
});
