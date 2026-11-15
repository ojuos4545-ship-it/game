#!/usr/bin/env bash
# 자동 점검 실행. Godot 경로가 다르면: GODOT=/경로/godot tools/run_tests.sh
set -e
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
"$GODOT" --headless --path . res://tests/test_runner.tscn
