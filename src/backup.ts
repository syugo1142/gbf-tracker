// バックアップ: データを JSON ファイルに書き出す・読み込む、全データを削除する
import { el, byId } from './util.ts';
import { defaultState, normalizeState } from './storage.ts';
import { app } from './app.ts';

// ファイル選択欄は見た目を整えにくいので隠し、キーボードでも押せる普通のボタンから開く
const importFile = byId('import-file', HTMLInputElement);

export function initBackup(): void {
  byId('export-btn', HTMLButtonElement).addEventListener('click', exportJson);
  byId('import-btn', HTMLButtonElement).addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', importJson);
  byId('reset-btn', HTMLButtonElement).addEventListener('click', resetAll);
}

// 今のデータを JSON ファイルにして、ダウンロードさせる
function exportJson(): void {
  const blob = new Blob([JSON.stringify(app.state, null, 2)], { type: 'application/json' });
  const a = el('a', {
    href: URL.createObjectURL(blob),
    download: `gbf-tracker-${today()}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

// 今日の日付を 2026-11-06 の形にする
// toISOString() は UTC（日本時間より9時間遅い）の日付になり、朝0時〜9時に書き出すと前の日になるので、この端末の時刻で作る
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 選ばれた JSON ファイルを読み込んで、今のデータを上書きする
async function importJson(): Promise<void> {
  const file = importFile.files?.[0];
  // 同じファイルをもう一度選んでも change が起きるように、選んだ状態を空にしておく
  importFile.value = '';
  if (!file) return;
  try {
    // JSON の中身はどんな形か分からないので unknown にし、normalizeState で形を整える
    const data: unknown = JSON.parse(await file.text());
    if (!confirm('現在のデータを読み込んだデータで上書きしますか？')) return;
    app.state = normalizeState(data);
    app.save();
    location.reload();
  } catch {
    alert('JSONの読み込みに失敗しました');
  }
}

function resetAll(): void {
  if (!confirm('すべてのデータを削除します。よろしいですか？')) return;
  app.state = defaultState();
  app.save();
  location.reload();
}
