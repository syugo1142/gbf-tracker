// アプリ全体の状態（素材と目標）。どのファイルも、この app を読み書きする
import { loadState, saveState } from './storage.ts';

export const app = {
  state: loadState(),
  // 今の状態を localStorage に保存する。保存できなかったら false
  save(): boolean {
    return saveState(app.state);
  },
};

// 昼／夜の切り替えは廃止した。前に保存された設定が残っていたら消しておく
try {
  localStorage.removeItem('gbf-tools-theme');
} catch {
  // localStorage が使えないときは、消すものもないので何もしない
}
