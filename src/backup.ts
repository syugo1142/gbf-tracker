import { el, byId } from './util.ts';
import { AppStorage } from './storage.ts';
import { app } from './app.ts';

// バックアップ
byId('export-btn', HTMLButtonElement).addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(app.state, null, 2)], { type: 'application/json' });
  const a = el('a', {
    href: URL.createObjectURL(blob),
    download: `gbf-tools-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

// ファイル選択欄は見た目を整えにくいので隠し、キーボードでも押せる普通のボタンから開く
const importFile = byId('import-file', HTMLInputElement);

byId('import-btn', HTMLButtonElement).addEventListener('click', () => {
  importFile.click();
});

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  importFile.value = '';
  if (!file) return;
  try {
    // JSON の中身はどんな形か分からないので unknown にし、normalize で形を整える
    const data: unknown = JSON.parse(await file.text());
    if (!confirm('現在のデータを読み込んだデータで上書きしますか？')) return;
    app.state = AppStorage.normalize(data);
    app.save();
    location.reload();
  } catch {
    alert('JSONの読み込みに失敗しました');
  }
});

byId('reset-btn', HTMLButtonElement).addEventListener('click', () => {
  if (!confirm('すべてのデータを削除します。よろしいですか？')) return;
  app.state = AppStorage.defaults();
  app.save();
  location.reload();
});
