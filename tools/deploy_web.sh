#!/usr/bin/env bash
# 웹 버전을 GitHub Pages(gh-pages 브랜치)에 올린다. 먼저 tools/export_web.sh 실행.
# gh-pages 브랜치는 빌드 결과만 담는 브랜치라 매번 새로 덮어쓴다(이전 빌드 기록은 남기지 않음).
set -e
cd "$(dirname "$0")/.."
REMOTE="$(git remote get-url origin)"
TMP="$(mktemp -d)"
cp -r build/web/. "$TMP/"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="Little Haven Dev" -c user.email="noreply@anthropic.com" commit -q -m "웹 테스트 버전 $(date +%Y-%m-%d)"
git push -f "$REMOTE" gh-pages
rm -rf "$TMP"
echo "올림 완료: https://ojuos4545-ship-it.github.io/game/"
