import { byId } from './util.ts';
import { AppStorage } from './storage.ts';
import type { AppState } from './storage.ts';
import { app } from './app.ts';

// 同期: 同期コードを合言葉にして、データを同期サーバー（server/server.ts）に送ったり取ってきたりする
// 素材のアイコンは送らない（ゲームの画像をサーバーに預からないため。データも小さくなる）。アイコンは端末ごとに登録する
// つなぐ先は、公開用では Cloudflare Workers のサーバー、開発用サーバー（npm run dev）では手元のサーバー（npm start）
// import.meta.env.DEV は Vite が入れる値で、npm run dev のときは true、npm run build で作った公開用では false になる
const SERVER = import.meta.env.DEV ? 'http://localhost:3000' : 'https://gbf-tracker-sync.syugo1142.workers.dev';

// 同期コードはデータとは別のキーに置く（バックアップの JSON に入れたり、ほかの端末に送ったりしないため）
const CODE_KEY = 'gbf-tools-sync';
// サーバーと同じきまり。英数字と - _ だけの 32〜64 文字
const CODE_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;
// サーバーが返事をしないときに、待つのをやめるまでの時間（ミリ秒）
const TIMEOUT = 10000;

const codeInput = byId('sync-code', HTMLInputElement);
const newBtn = byId('sync-new', HTMLButtonElement);
const copyBtn = byId('sync-copy', HTMLButtonElement);
const pushBtn = byId('sync-push', HTMLButtonElement);
const pullBtn = byId('sync-pull', HTMLButtonElement);
const deleteBtn = byId('sync-delete', HTMLButtonElement);
const status = byId('sync-status', HTMLParagraphElement);

// 推測されない同期コードを作る。でたらめな 32 バイトを、URL に使える文字（英数字と - _）の 43 文字にする
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function loadCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveCode(code: string): void {
  try {
    localStorage.setItem(CODE_KEY, code);
  } catch {}
}

// 入力欄の同期コードを読む。形が違えば知らせて null を返す
function currentCode(): string | null {
  const code = codeInput.value.trim();
  if (CODE_PATTERN.test(code)) return code;
  status.textContent = code
    ? '同期コードの形が違います（英数字と - _ だけの 32〜64 文字）'
    : '同期コードがありません。「新しく作る」を押すか、ほかの端末の同期コードを貼り付けてください';
  return null;
}

// 通信している間はボタンを押せなくする（二重に送らないため）
function setBusy(busy: boolean): void {
  for (const btn of [newBtn, copyBtn, pushBtn, pullBtn, deleteBtn]) btn.disabled = busy;
}

// サーバーにリクエストを送り、返事の番号（ステータスコード）と中身の JSON を返す
// サーバーにつながらないときは fetch がエラーを投げる
async function request(method: 'GET' | 'PUT' | 'DELETE', code: string, body?: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${SERVER}/api/sync/${code}`, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const json: unknown = await res.json().catch(() => null);
  return { status: res.status, json };
}

// 送るデータから、素材のアイコンを抜く
function withoutIcons(state: AppState): AppState {
  return { ...state, materials: state.materials.map(({ icon: _icon, ...m }) => m) };
}

// 取ってきたデータに、この端末のアイコンを付け直す。同じ素材は ID で探し、見つからなければ名前で探す
// （同期する前にそれぞれの端末で登録した素材は、同じ素材でも ID が違うため）
function withLocalIcons(next: AppState, current: AppState): AppState {
  const iconById = new Map<string, string>();
  const iconByName = new Map<string, string>();
  for (const m of current.materials) {
    if (!m.icon) continue;
    iconById.set(m.id, m.icon);
    iconByName.set(m.name, m.icon);
  }
  return {
    ...next,
    materials: next.materials.map((m) => {
      // 中身の形までは確かめていないので、オブジェクトでないものはそのまま残す（normalize と同じ扱い）
      if (typeof m !== 'object' || m === null) return m;
      const { icon: _icon, ...rest } = m;
      const icon = iconById.get(m.id) ?? iconByName.get(m.name);
      return icon ? { ...rest, icon } : rest;
    }),
  };
}

// ISO 形式の日時（2026-11-02T03:04:05.000Z）を、日本の書き方（2026/11/2 12:04:05）にする
function formatTime(value: unknown): string {
  const date = new Date(typeof value === 'string' ? value : NaN);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ja-JP');
}

const NETWORK_ERROR = import.meta.env.DEV
  ? 'サーバーにつながりませんでした。同期サーバー（npm start）が動いているか確かめてください'
  : 'サーバーにつながりませんでした。インターネットにつながっているか確かめて、しばらくしてからもう一度お試しください';

async function push(): Promise<void> {
  const code = currentCode();
  if (!code) return;
  setBusy(true);
  status.textContent = '送っています…';
  try {
    const res = await request('PUT', code, withoutIcons(app.state));
    if (res.status === 200) {
      const time = formatTime((res.json as { updatedAt?: unknown } | null)?.updatedAt);
      status.textContent = `サーバーに送りました（${time}）`;
    } else if (res.status === 413) {
      status.textContent = 'データが大きすぎて送れませんでした（128KB まで）';
    } else if (res.status === 503) {
      status.textContent = 'サーバーに保存できる同期コードの数がいっぱいで、新しい同期コードでは送れませんでした';
    } else {
      status.textContent = `送れませんでした（エラー ${res.status}）`;
    }
  } catch {
    status.textContent = NETWORK_ERROR;
  } finally {
    setBusy(false);
  }
}

async function pull(): Promise<void> {
  const code = currentCode();
  if (!code) return;
  setBusy(true);
  status.textContent = '取ってきています…';
  try {
    const res = await request('GET', code);
    if (res.status === 404) {
      status.textContent = 'この同期コードのデータは、サーバーにありません。先にほかの端末から送ってください（180日間送られなかったデータは消えます）';
      return;
    }
    // 返事の中身は { data, updatedAt } の形のはず。違っていたら読み込まない
    const saved = res.json as { data?: unknown; updatedAt?: unknown } | null;
    if (res.status !== 200 || typeof saved?.data !== 'object' || saved.data === null) {
      status.textContent = `取ってこられませんでした（エラー ${res.status}）`;
      return;
    }
    const time = formatTime(saved.updatedAt);
    if (!confirm(`サーバーのデータ（${time} に保存）で、この端末のデータを上書きしますか？`)) {
      status.textContent = '取ってくるのをやめました';
      return;
    }
    // JSON の読み込み（backup.ts）と同じく、形を整えてから保存し、画面を作り直す。アイコンはこの端末のものを残す
    app.state = withLocalIcons(AppStorage.normalize(saved.data), app.state);
    app.save();
    location.reload();
  } catch {
    status.textContent = NETWORK_ERROR;
  } finally {
    setBusy(false);
  }
}

// サーバーにあるこの同期コードのデータを消す。この端末のデータと同期コードは残す（もう一度送れば、また同期できる）
async function remove(): Promise<void> {
  const code = currentCode();
  if (!code) return;
  if (!confirm('サーバーにあるこの同期コードのデータを消しますか？\nこの端末のデータは消えません。ほかの端末からは取ってこられなくなります。')) return;
  setBusy(true);
  status.textContent = '消しています…';
  try {
    const res = await request('DELETE', code);
    if (res.status === 200) {
      status.textContent = 'サーバーのデータを消しました。この端末のデータは残っています';
    } else if (res.status === 404) {
      status.textContent = 'この同期コードのデータは、サーバーにありません（消してあるか、180日間送られなかったため消えています）';
    } else {
      status.textContent = `消せませんでした（エラー ${res.status}）`;
    }
  } catch {
    status.textContent = NETWORK_ERROR;
  } finally {
    setBusy(false);
  }
}

codeInput.value = loadCode();

newBtn.addEventListener('click', () => {
  if (codeInput.value && !confirm('今の同期コードを捨てて、新しい同期コードを作りますか？')) return;
  codeInput.value = newCode();
  saveCode(codeInput.value);
  status.textContent = '新しい同期コードを作りました。「コピー」を押して、ほかの端末の同期コードの欄に貼り付けてください';
});

// 同期コードは 43 文字あって手で写すのは大変なので、コピーできるようにする
// クリップボードは https のページ（と localhost）でしか使えず、ブラウザが断ることもあるので、失敗したら欄を選んだ状態にする
copyBtn.addEventListener('click', async () => {
  const code = currentCode();
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    status.textContent = '同期コードをコピーしました。人に見られる場所には貼らないでください';
  } catch {
    codeInput.select();
    status.textContent = 'コピーできませんでした。同期コードの欄を選んだので、手でコピーしてください';
  }
});

// ほかの端末の同期コードを貼り付けたときに覚えておく。形が違うものは覚えない
codeInput.addEventListener('change', () => {
  const code = codeInput.value.trim();
  if (code === '' || CODE_PATTERN.test(code)) saveCode(code);
  else currentCode();
});

pushBtn.addEventListener('click', push);
pullBtn.addEventListener('click', pull);
deleteBtn.addEventListener('click', remove);
