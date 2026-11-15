#!/usr/bin/env bash
# 게임 화면 캡처 (리눅스 클라우드 환경용, 가상 화면 xvfb 사용)
# 사용법: tools/screenshot.sh [저장경로.png] [대기프레임수] [추가옵션...]
#   추가옵션 예: --press=PetsButton  (해당 이름의 버튼을 누른 뒤 캡처)
set -e
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
OUT="$(realpath -m "${1:-build/screenshot.png}")"
FRAMES="${2:-60}"
shift 2 2>/dev/null || shift $#
mkdir -p "$(dirname "$OUT")"
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
timeout 90 xvfb-run -a -s "-screen 0 1280x720x24" "$GODOT" --path . --rendering-driver opengl3 \
  --resolution 1280x720 res://tools/capture/screenshot_runner.tscn -- --out="$OUT" --frames="$FRAMES" "$@"
