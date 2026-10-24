#!/usr/bin/env bash
# 会話を始めたときに Claude Code が自動で実行する（.claude/settings.json の SessionStart フック）。
# ここで echo した内容が、会話の最初に Claude へ渡される。
# git fetch は GitHub の変更を「確認するだけ」で、手元のファイルは書き換えない。取り込み（pull）は本人がやる。

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

echo "【会話開始時の自動チェック】"

if ! git fetch --quiet 2>/dev/null; then
  echo "※ git fetch に失敗しました（オフラインなど）。GitHub の最新は確認できていません。"
fi

echo
echo "## git status -sb（今の状態）"
git status -sb

# 上流（GitHub 側の main）との差を数える
behind=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo 0)
ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo 0)

if [ "$behind" -gt 0 ]; then
  echo
  echo "⚠ GitHub に、まだ取り込んでいない変更が ${behind} 件あります。"
  echo "  作業を始める前に、本人に git pull をしてもらうよう伝えること（Claude は pull しない）。"
fi
if [ "$ahead" -gt 0 ]; then
  echo
  echo "⚠ まだ push していない commit が ${ahead} 件あります。もう一方のPCでは見えないので、本人に知らせること。"
fi

echo
echo "## 最近の記録（git log --oneline -10）"
git log --oneline -10

if [ -f docs/gbf-knowledge.md ]; then
  echo
  echo "プリセットや素材名を扱うときは、先に docs/gbf-knowledge.md（調べて確かめたグラブルの知識）を読むこと。"
fi

exit 0
