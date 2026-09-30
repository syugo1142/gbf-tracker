// localStorage への保存・読み込み
const AppStorage = (() => {
  const KEY = 'gbf-tools-v1';

  function defaults() {
    return {
      materials: [], // { id, name, owned, perRun, icon?: 画像の data URL }
      targets: [],   // { id, name, done, reqs: [{ materialId, qty }] }
      spark: { crystals: 0, singles: 0, tens: 0, sparks: 0, daily: 0, extra: 0, date: '' },
    };
  }

  // 読み込んだデータの欠けている項目を既定値で埋める
  function normalize(data) {
    const d = defaults();
    return {
      materials: Array.isArray(data?.materials) ? data.materials : d.materials,
      targets: Array.isArray(data?.targets) ? data.targets : d.targets,
      spark: { ...d.spark, ...(data?.spark || {}) },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : defaults();
    } catch (e) {
      console.warn('読み込みに失敗しました', e);
      return defaults();
    }
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
