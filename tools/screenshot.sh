#!/usr/bin/env bash
# 게임 화면 캡처 (리눅스 클라우드 환경용, 가상 화면 xvfb 사용)
# 사용법: tools/screenshot.sh [저장경로.png] [대기프레임수] [추가옵션...]
#   추가옵션: --press=버튼이름  --scene=res://화면.tscn  --give=자원:수량
#   해상도 변경: RES=2560x1440 tools/screenshot.sh ...
set -e
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
OUT="$(realpath -m "${1:-build/screenshot.png}")"
FRAMES="${2:-60}"
RES="${RES:-1280x720}"
shift 2 2>/dev/null || shift $#
mkdir -p "$(dirname "$OUT")"
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
timeout 90 xvfb-run -a -s "-screen 0 ${RES}x24" "$GODOT" --path . --rendering-driver opengl3 \
  --resolution "$RES" res://tools/capture/screenshot_runner.tscn -- --out="$OUT" --frames="$FRAMES" "$@"
