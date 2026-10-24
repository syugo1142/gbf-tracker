# CLAUDE.md（gbf-tracker）

グラブル（グランブルーファンタジー）の素材集めを管理する Web ツール「グラブル便利ツール」のリポジトリ。
公開ページ: https://syugo1142.github.io/gbf-tracker/ （GitHub Pages、main ブランチの直下）
姉妹リポジトリ: gbf-tenjou-keisan（天井計算。https://syugo1142.github.io/gbf-tenjou-keisan/ ）

## 必ず守ること
- **Git の操作は本人がやる。** Claude は commit・push・pull・init・remote の変更など、Git の状態を変える操作を実行しない。作業が終わったら、本人が実行するコマンドを示す（`git add -A` → `git commit -m "日本語のメッセージ"` → `git push`）。リポジトリの作成・改名・Pages の設定など GitHub 上の操作も本人がやる
- **説明は基礎から細かく。** 本人はバックエンドやインフラを勉強中。専門用語は初めて出るときに意味を説明し、なぜそうするのかも書く。手順は省略せず、どの画面のどこを押すかまで書く
- **このリポジトリは公開されている。** README・CLAUDE.md・コード・コメント・コミットメッセージに個人的な情報（本名、メールアドレス、学校、就職活動の情報、パソコン内の個人のパスなど）を書かない
- 返答・コードのコメント・コミットメッセージは日本語
- 案内するコマンドのパスは `\`（¥）ではなく `/` で書く

## 会話の始まり（自動チェック）
- `.claude/settings.json` の SessionStart フックで、会話を始めると `.claude/hooks/session-start.sh` が自動で動く。`git fetch`（GitHub の変更を確認するだけ。手元のファイルは変わらない）、`git status -sb`、`git log --oneline -10` の結果が会話の最初に渡される
- GitHub に取り込んでいない変更があると表示されたら、作業の前に本人に `git pull` を頼む（Claude は pull しない）。push していない commit があるときも知らせる
- 2台のPCで作業している。どちらのPCで何をしたかは、この自動チェックの `git log` で把握する
- グラブルの素材名・属性の対応・入手先・用語は `docs/gbf-knowledge.md` にまとめてある。プリセットや素材名を扱う前に読む。新しく確かめたことは、ここに追記する

## 方針
- フロントエンドだけで動く（素の JavaScript、ビルドなし）。ES Modules は使わず普通の `<script>` タグで読み込む（`index.html` をファイルとして直接開いても動くようにするため）
- データはブラウザの localStorage に保存する。キーは `gbf-tools-v1`（素材と目標）、`gbf-tools-open`（折りたたみの開閉）。昼／夜の切り替えは廃止した（古い `gbf-tools-theme` は `app.js` で消す）
- ゲームの規約に反する機能（自動操作、通信の読み取り、非公開情報の取得）は入れない。数は手入力だけ
- ゲームの画像やバックアップの JSON はリポジトリに入れない（`.gitignore` で除外済み。`.claude/settings.json` だけは例外として入れる）。素材のアイコンは使う人が自分のブラウザに登録する形
- DOM は `js/util.js` の `el()` で作る（文字列は textContent で入れるので XSS の心配がない）。`innerHTML` は使わない

## ファイル
- `index.html` … 画面（目標、全素材の合計、バックアップ）
- `css/style.css` … 空のテーマ（青空）。色は `:root` の変数で決める
- `js/storage.js` … 保存と読み込み。古いデータにあった天井計算の値は `moveSparkData` で天井計算側のキー（`gbf-spark-v1`）へ一度だけ移す
- `js/presets.js` … 目標プリセット（必要素材データ）。`PRESET_CATEGORIES`・`CHARACTER_GROUPS` でキャラ／武器に分ける。`PRESET_RENAMES` は仮の素材名から正式名称への移行表
- `js/sources.js` … 素材の入手先（素材名の下に表示）
- `js/icons.js` … 素材アイコン（登録画像を 64×64 の webp に縮めて保存）
- `js/tracker.js` … 素材トラッカー本体
- `js/app.js` … 状態の保持。`js/backup.js` … JSON の書き出し／読み込み
- `server/server.mjs` … 端末間の同期機能を作り始めたところ（Node.js の http モジュール。今は `/api/hello` を返すだけ）。GitHub Pages ではサーバーは動かないので、公開ページとは別の場所で動かす必要がある

## プリセットのデータ
- 出典は GameWith の各記事（`source` に URL）。調べ方の注意と確認済みの事実は `docs/gbf-knowledge.md`。WebFetch の要約は信用せず、curl で取った HTML の本文と照合してから入れる。数値の正確さを最重視する
- 正式名称が確認できない素材は仮の名前にし、`note` とユーザーへの報告で明示する。残っている仮の名前: 終末武器の「恩寵（属性）」（風以外）と「新恩寵（属性）」、光・闇の Lv240 の「光輪（属性・要確認）」
- 構造は `{ id, group, sub?, name, source, note?, reqs: [{ name, qty }] }`。目標名は `presetLabel(p)`、まとめプリセットは `sumReqs` で作る
- 素材名を変えたときは `PRESET_RENAMES` に旧名→新名を足す（保存済みデータを自動で移行するため）

## 動作確認のしかた
ビルドもテストフレームワークもない。変更後はヘッドレスの Chrome で開いてエラーがないか確かめる。
- `chrome --headless=new --allow-file-access-from-files --dump-dom <URL>` で DOM を取り出す。確認用の JS を足した HTML を一時フォルダに作って読み込ませる
- 見た目は `--screenshot` と `--window-size` で画像にして確認する（アニメーション途中を撮らないよう `--virtual-time-budget=2000` を付ける）
