#!/usr/bin/env bash
# 웹(브라우저)용 게임 만들기 → build/web/
# 필요: Godot 4.7.2 웹 내보내기 템플릿 (~/.local/share/godot/export_templates/4.7.2.stable/web_nothreads_release.zip)
set -e
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
rm -rf build/web && mkdir -p build/web
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
timeout 300 "$GODOT" --headless --path . --export-release "Web" build/web/index.html
touch build/web/.nojekyll
ls -la build/web
