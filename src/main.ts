// 画面の入口。index.html から読み込まれ、ここから各ファイルを import する
import './style.css';
import { app } from './app.ts';
import { Tracker } from './tracker.ts';
import './backup.ts';

Tracker.init(app);
