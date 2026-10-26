import { defineConfig } from 'vite';

export default defineConfig({
  // 公開ページは https://syugo1142.github.io/gbf-tracker/ のようにフォルダの下に置かれるので、
  // ビルドしたファイルを相対パス（./assets/...）で読み込むようにする
  base: './',
});
