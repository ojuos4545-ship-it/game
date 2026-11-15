#!/usr/bin/env bash
# Windows 실행 파일 만들기 → build/windows/LittleHaven.exe (+ 압축본 LittleHaven-windows.zip)
# 필요: Godot 4.7.2 Windows 내보내기 템플릿 (~/.local/share/godot/export_templates/4.7.2.stable/windows_release_x86_64.exe)
set -e
cd "$(dirname "$0")/.."
GODOT="${GODOT:-godot}"
rm -rf build/windows && mkdir -p build/windows
"$GODOT" --headless --path . --import >/dev/null 2>&1 || true
timeout 300 "$GODOT" --headless --path . --export-release "Windows" build/windows/LittleHaven.exe
cd build/windows && rm -f LittleHaven-windows.zip && python3 -c "
import zipfile
with zipfile.ZipFile('LittleHaven-windows.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.write('LittleHaven.exe')
"
ls -la
