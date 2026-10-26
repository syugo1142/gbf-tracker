// localStorage への保存・読み込み

// 保存データの形。ほかのファイルからも import して使う
export interface Material {
  id: string;
  name: string;
  owned: number;   // 所持数
  perRun: number;  // 1周あたりの平均ドロップ数（0 は未入力）
  icon?: string;   // 登録した画像の data URL（ないこともある）
}

export type Category = 'キャラ' | '武器' | 'その他';

export interface Requirement {
  materialId: string;
  qty: number;
}

export interface Target {
  id: string;
  name: string;
  category?: Category; // 古いデータにはないことがある
  done: boolean;
  reqs: Requirement[];
}

export interface AppState {
  materials: Material[];
  targets: Target[];
}

export const AppStorage = (() => {
  const KEY = 'gbf-tools-v1';

  function defaults(): AppState {
    return {
      materials: [],
      targets: [],
    };
  }

  // 読み込んだデータの欠けている項目を既定値で埋める
  // data は JSON.parse の結果なので、どんな形か分からない（unknown）。配列かどうかだけ確かめる
  // （配列の中身の形までは確かめていない）
  function normalize(data: unknown): AppState {
    const d = defaults();
    const obj = (typeof data === 'object' && data !== null ? data : {}) as Partial<Record<keyof AppState, unknown>>;
    return {
      materials: Array.isArray(obj.materials) ? (obj.materials as Material[]) : d.materials,
      targets: Array.isArray(obj.targets) ? (obj.targets as Target[]) : d.targets,
    };
  }

  function load(): AppState {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const data: unknown = JSON.parse(raw);
      moveSparkData(data);
      return normalize(data);
    } catch (e) {
      console.warn('読み込みに失敗しました', e);
      return defaults();
    }
  }

  // 以前は天井計算の手持ちも同じキーに入れていた。天井計算は別のツール（tenjou-keisan）になったので、
  // そちらのキーがまだ空なら移しておく（このキーからは次の保存で消える）
  function moveSparkData(data: unknown): void {
    if (typeof data !== 'object' || data === null || !('spark' in data) || !data.spark) return;
    try {
      if (localStorage.getItem('gbf-spark-v1') === null) localStorage.setItem('gbf-spark-v1', JSON.stringify(data.spark));
    } catch {}
  }

  function save(state: AppState): boolean {
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
