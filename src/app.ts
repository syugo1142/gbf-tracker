import { AppStorage } from './storage.ts';

// アプリ全体: 状態の保持。初期化は main.js で行う
export const app = {
  state: AppStorage.load(),
  save(): boolean { return AppStorage.save(this.state); },
};

// 昼／夜の切り替えは廃止した。前に保存された設定が残っていたら消しておく
try { localStorage.removeItem('gbf-tools-theme'); } catch {}
