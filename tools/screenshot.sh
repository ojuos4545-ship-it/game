#!/usr/bin/env bash
# 게임 화면 캡처 (리눅스 클라우드 환경용, 가상 화면 xvfb 사용)
# 사용법: tools/screenshot.sh [저장경로.png] [대기프레임수]
set -e
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
OUT="$(realpath -m "${1:-build/screenshot.png}")"
FRAMES="${2:-60}"
mkdir -p "$(dirname "$OUT")"
xvfb-run -a -s "-screen 0 1280x720x24" "$GODOT" --path . --rendering-driver opengl3 \
  --resolution 1280x720 res://tools/capture/screenshot_runner.tscn -- --out="$OUT" --frames="$FRAMES"
