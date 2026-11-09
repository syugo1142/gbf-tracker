// 画面の入口。index.html から読み込まれ、画面の各部分をこの順に準備する
import './style.css';
import { initBackup } from './backup.ts';
import { initSync } from './sync.ts';
import { initTracker } from './tracker.ts';

// バックアップと同期を先に準備する
// （目標の表示で思わぬエラーが起きても、書き出し・読み込み・削除のボタンは使えるようにするため）
initBackup();
initSync();
initTracker();
