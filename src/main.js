// 画面の入口。index.html から読み込まれ、ここから各ファイルを import する
import './style.css';
import { app } from './app.js';
import { Tracker } from './tracker.js';
import './backup.js';

Tracker.init(app);
