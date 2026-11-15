# HANDOFF — 다음 작업 인계

**마지막 작업**: 2026-11-15, 클라우드(Claude Code 원격 환경)

## 한 줄 요약
2단계(기본 게임 화면) 완료. 다음은 **3단계: 펫 시스템**.

## 이번에 한 일
- 쿼터뷰 마을: `scenes/world/` (카메라·조명·지형·장식), 작업장 부지 `scenes/workshops/workshop_plot.*`
- 화면 UI: `scenes/ui/hud.*` (자원바·메뉴 버튼), 공통 창 틀 `scenes/ui/menu_window.*`, 디자인 `assets/ui/main_theme.tres`
- 데이터: `data/resources.json`, `data/workshops.json` → `DataDB`가 읽고 검사
- `GameState`에 자원 수량 + `resource_changed` 신호
- 화면 캡처 도구에 버튼 누르기 옵션(`--press=버튼이름`)과 90초 시간 제한 추가

## 다음에 할 일 (순서대로)
1. 3단계 시작: `data/pets.json`(8종) → DataDB 로딩 → GameState 보유 펫·도감 → 펫 임시 3D 모형 → 펫 창 → 입양 → 도감 창
2. 펫 창·도감 창 내용은 `menu_window.gd`의 `get_content()` 영역에 채운다 (안내 문구 Placeholder는 숨김)
3. 각 작업마다 `tools/run_tests.sh` + `tools/screenshot.sh`로 확인

## 이어받는 방법
- 저장소: https://github.com/ojuos4545-ship-it/game
- 기존 웹(HTML/JS) 버전 자료는 삭제함. 필요하면 Git 기록에서 복구 가능.
```bash
git pull
```
```bash
tools/run_tests.sh
```
- 통과 24/실패 0 이 나오면 정상 상태.
- Godot 에디터에서 열 때: Godot 4.7.2 → 가져오기 → `project.godot`

## 주의 사항
- 작업장 위치를 바꿀 땐 `world.tscn`의 Plots 위치와 `world.gd`의 `PLOT_SCREEN_POS`를 함께 바꿀 것 (길·장식이 이 값을 기준으로 배치됨).
- 3D 이름표(Label3D)는 창을 열면 어둡게 가려짐 — 정상.
- 기획 수치는 `GAME_DESIGN.md`에 가안으로 정리됨. 코드에는 쓰지 말고 `data/*.json`에 넣을 것.
