// localStorage への保存・読み込み
export const AppStorage = (() => {
  const KEY = 'gbf-tools-v1';

  function defaults() {
    return {
      materials: [], // { id, name, owned, perRun, icon?: 画像の data URL }
      targets: [],   // { id, name, category?: 'キャラ' | '武器' | 'その他', done, reqs: [{ materialId, qty }] }
    };
  }

  // 読み込んだデータの欠けている項目を既定値で埋める
  function normalize(data) {
    const d = defaults();
    return {
      materials: Array.isArray(data?.materials) ? data.materials : d.materials,
      targets: Array.isArray(data?.targets) ? data.targets : d.targets,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const data = JSON.parse(raw);
      moveSparkData(data);
      return normalize(data);
    } catch (e) {
      console.warn('読み込みに失敗しました', e);
      return defaults();
    }
  }

  // 以前は天井計算の手持ちも同じキーに入れていた。天井計算は別のツール（tenjou-keisan）になったので、
  // そちらのキーがまだ空なら移しておく（このキーからは次の保存で消える）
  function moveSparkData(data) {
    if (!data?.spark) return;
    try {
      if (localStorage.getItem('gbf-spark-v1') === null) localStorage.setItem('gbf-spark-v1', JSON.stringify(data.spark));
    } catch {}
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('保存に失敗しました', e);
      return false;
    }
  }

  return { load, save, defaults, normalize };
})();
