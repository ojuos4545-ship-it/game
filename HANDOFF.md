# HANDOFF — 다음 작업 인계

**마지막 작업**: 2026-11-15, 클라우드(Claude Code 원격 환경)

## 한 줄 요약
1단계(프로젝트 기본 구성) 완료. 다음은 **2단계: 기본 게임 화면**.

## 이번에 한 일
- Godot 4.7.2 프로젝트 생성, 폴더 구조, 관리 문서, 한글 폰트
- 관리자 3종 뼈대, 자동 점검·화면 캡처 도구
- 실행 확인용 화면 (나중에 2단계에서 교체)

## 다음에 할 일 (순서대로)
1. 2단계 시작: `scenes/world/`에 지형·카메라·조명 → 작업장 부지 3곳 → 상단 자원바 → 하단 메뉴
2. 각 작업마다 `tools/run_tests.sh` + `tools/screenshot.sh`로 확인

## 이어받는 방법
- 저장소: https://github.com/ojuos4545-ship-it/game
- 기존 웹(HTML/JS) 버전 자료는 삭제함. 필요하면 Git 기록에서 복구 가능.
```bash
git pull
```
```bash
tools/run_tests.sh
```
- 통과 7/실패 0 이 나오면 정상 상태.
- Godot 에디터에서 열 때: Godot 4.7.2 → 가져오기 → `project.godot`

## 주의 사항
- 메인 화면(`scenes/main/main.tscn`)의 회전 상자는 임시. 2단계에서 교체해도 됨.
- 기획 수치는 `GAME_DESIGN.md`에 가안으로 정리됨. 코드에는 쓰지 말고 `data/*.json`에 넣을 것.
