// アプリ全体: 状態の保持、タブ切り替え、バックアップ
const app = {
  state: AppStorage.load(),
  save() { return AppStorage.save(this.state); },
};

// 昼／夜の切り替え（既定は夜。選んだほうをこの閲覧者のブラウザに覚えておく）
const themeToggle = document.getElementById('theme-toggle');
function applyTheme(theme) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  themeToggle.textContent = theme === 'light' ? '🌙 夜にする' : '☀ 昼にする';
  themeToggle.setAttribute('aria-label', theme === 'light' ? '夜の配色に切り替える' : '昼の配色に切り替える');
}
applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try { localStorage.setItem('gbf-tools-theme', next); } catch {}
});

// タブ切り替え（最後に開いたタブを覚えておく）
function showTab(name) {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.tab === name);
  }
  for (const panel of document.querySelectorAll('.panel')) {
    panel.classList.toggle('active', panel.id === `tab-${name}`);
  }
  try { localStorage.setItem('gbf-tools-tab', name); } catch {}
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => showTab(tab.dataset.tab));
}
try {
  const last = localStorage.getItem('gbf-tools-tab');
  if (last && document.getElementById(`tab-${last}`)) showTab(last);
} catch {}

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

Tracker.init(app);
Spark.init(app);
