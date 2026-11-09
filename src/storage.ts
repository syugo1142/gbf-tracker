// 保存データの形（型）と、localStorage への保存・読み込み

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

// localStorage のキー。変えると、使っている人のデータが読めなくなるので変えない
const KEY = 'gbf-tools-v1';
// 天井計算（gbf-tenjou-keisan）が使うキー
const SPARK_KEY = 'gbf-spark-v1';

// 何も保存されていないときの状態
export function defaultState(): AppState {
  return {
    materials: [],
    targets: [],
  };
}

// 読み込んだデータの欠けている項目を、空の配列で埋める
// data は JSON.parse の結果なので、どんな形か分からない（unknown）。配列かどうかだけ確かめる
// （配列の中身の形までは確かめていない）
export function normalizeState(data: unknown): AppState {
  if (typeof data !== 'object' || data === null) return defaultState();
  const { materials, targets } = data as { materials?: unknown; targets?: unknown };
  return {
    materials: Array.isArray(materials) ? materials : [],
    targets: Array.isArray(targets) ? targets : [],
  };
}

// localStorage から読み込む。読めなかったときは空の状態にする
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const data: unknown = JSON.parse(raw);
    moveSparkData(data);
    return normalizeState(data);
  } catch (e) {
    console.warn('読み込みに失敗しました', e);
    return defaultState();
  }
}

// localStorage に保存する。容量が足りないなどで保存できなかったら false
export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('保存に失敗しました', e);
    return false;
  }
}

// 以前は天井計算の手持ちも同じキーに入れていた。天井計算は別のツール（gbf-tenjou-keisan）になったので、
// そちらのキーがまだ空なら移しておく（このキーからは次の保存で消える）
function moveSparkData(data: unknown): void {
  if (typeof data !== 'object' || data === null || !('spark' in data) || !data.spark) return;
  try {
    // 天井計算のほうで入力し直したデータを上書きしないように、空のときだけ移す
    if (localStorage.getItem(SPARK_KEY) === null) {
      localStorage.setItem(SPARK_KEY, JSON.stringify(data.spark));
    }
  } catch {
    // 移せなくても、素材管理は使えるので何もしない
  }
}
