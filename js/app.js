// アプリ全体: 状態の保持と昼／夜の切り替え。初期化は HTML の最後で行う
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
