// バックアップ
document.getElementById('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(app.state, null, 2)], { type: 'application/json' });
  const a = el('a', {
    href: URL.createObjectURL(blob),
    download: `gbf-tools-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!confirm('現在のデータを読み込んだデータで上書きしますか？')) return;
    app.state = AppStorage.normalize(data);
    app.save();
    location.reload();
  } catch {
    alert('JSONの読み込みに失敗しました');
  }
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('すべてのデータを削除します。よろしいですか？')) return;
  app.state = AppStorage.defaults();
  app.save();
  location.reload();
});
