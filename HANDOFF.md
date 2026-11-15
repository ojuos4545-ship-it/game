# HANDOFF — 다음 작업 인계

**마지막 작업**: 2026-11-15, 클라우드(Claude Code 원격 환경)

## 한 줄 요약
6단계(저장 및 통합) 완료. 다음은 **7단계: 최종 완성** (밸런스, 오류 수정, 실행 파일).

## 이번에 한 일
- (6단계) 저장: `GameState.to_save()/load_save()`(검증 포함), `SaveManager`(5초마다 바뀐 것이 있으면 저장, `enabled`로 끄기, `save_path`), 메뉴 `scenes/ui/menu_view.gd`(새 게임), 축하 `celebrate_view.gd`(`GameState.dex_completed`)
- (5.5) 자동 수집: `balance.json` `auto_collect`, `WorkshopSystem.tick()` 끝에서 `collect()`
- (5단계) 작업장 데이터 `data/workshops.json`(levels, likes, work), 규칙 `scripts/systems/workshop_system.gd`(배치·생산·수집·업그레이드), 생산 시계 `production_clock.gd`(메인 화면 안), 작업장 3D `scenes/workshops/workshop_plot.gd`(소품·대상·일꾼·+N·클릭), 노동 동작 `PetVisual.play_work()`, 작업장 창 `scenes/ui/workshop_view.gd`
- (5단계) 웹 버전: `tools/export_web.sh` → `tools/deploy_web.sh` (gh-pages 브랜치, 템플릿 필요)
- (4단계) 조합표 `data/recipes.json`, `DataDB.find_recipe(a, b)`, 규칙 `scripts/systems/combine_system.gd`, 창 `scenes/ui/combine_view.gd`
- (3단계) 데이터: `data/pets.json`(8종), `elements.json`(속성), `balance.json`(시작 펫·자원)
- `GameState`: 보유 펫(`pets`: uid·species·workshop), 도감(`discovered`), 비용 지불(`can_afford`/`spend`), `new_game()`
- 규칙: `scripts/systems/adoption_system.gd` (입양)
- 펫 3D 모형: `scenes/pets/pet_visual.gd` (look 종류별 도형 조합, `play_idle()`)
- 초상화: `PetPortraits` 자동 로드 — 3D 모형을 작은 화면에 찍어 UI 그림으로 사용
- 창 내용: `scenes/ui/pets_view.gd`, `dex_view.gd`, 공통 조각 `ui_parts.gd`, 알림 `HUD.show_toast()`
- 조사 도우미 `scripts/util/korean.gd` (을/를, 이/가, 은/는)
- 캡처 도구 옵션 추가: `--scene=`(다른 화면), `--give=berry:30`(개발용 자원 지급)
- 펫 모형 한눈에 보기: `tools/screenshot.sh build/pets.png 20 --scene=res://tools/capture/pet_gallery.tscn`

## 다음에 할 일 (순서대로)
1. 밸런스: 목표 20~30분에 도감 완성. `tests/test_runner.gd`의 `_test_full_cycle` 결과(생산 횟수·분)를 기준으로 `data/*.json` 비용·생산량 조정 (입양·업그레이드도 쓰는 현실적인 플레이로 모의)
2. 사용자 테스트 피드백 반영 (오류 수정)
3. Windows 실행 파일: 내보내기 템플릿에서 windows 템플릿 추출 → export preset 추가 → .exe 만들기 (GitHub Release 또는 사용자 PC Godot에서)
4. 최종 점검 → main 반영 → 웹 버전 다시 올리기

## 이어받는 방법
- 저장소: https://github.com/ojuos4545-ship-it/game
- 기존 웹(HTML/JS) 버전 자료는 삭제함. 필요하면 Git 기록에서 복구 가능.
```bash
git pull
```
```bash
tools/run_tests.sh
```
- 통과 176/실패 0 이 나오면 정상 상태.
- Godot 에디터에서 열 때: Godot 4.7.2 → 가져오기 → `project.godot`

## 주의 사항
- 작업장 위치를 바꿀 땐 `world.tscn`의 Plots 위치와 `world.gd`의 `PLOT_SCREEN_POS`를 함께 바꿀 것 (길·장식이 이 값을 기준으로 배치됨).
- 3D 이름표(Label3D)는 창을 열면 어둡게 가려짐 — 정상.
- 자동 점검과 화면 캡처는 `SaveManager.enabled = false`로 실제 저장 파일을 건드리지 않음.
- 3D 클릭은 `world.gd`에서 `physics_object_picking = true`로 켬. 작업장 클릭 영역은 `ClickArea`(Area3D).
- 일하는 펫의 도구는 카메라 쪽 손(왼손)에 들어야 몸에 가려지지 않음.
- 고해상도 캡처: `RES=2560x1440 tools/screenshot.sh ...`
- 클라우드 화면 캡처는 첫 화면 준비가 몇 초 걸려서, 2초짜리 알림을 찍으려면 대기 프레임을 2 정도로 짧게.
- 작업 브랜치는 `claude/little-haven-godot`, 단계 완료 시 `main`에 반영 (사용자 승인).
- 기획 수치는 `GAME_DESIGN.md`에 가안으로 정리됨. 코드에는 쓰지 말고 `data/*.json`에 넣을 것.
