# HANDOFF — 다음 작업 인계

**마지막 작업**: 2026-11-15, 클라우드(Claude Code 원격 환경)

## 한 줄 요약
4단계(조합 시스템) 완료. 다음은 **5단계: 작업장 시스템** (가장 중요: 펫이 일하는 모습).

## 이번에 한 일
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
1. `data/workshops.json`에 레벨별 수치(슬롯·생산 보너스·창고·업그레이드 비용), 좋아하는 속성 추가 (GAME_DESIGN.md 7장)
2. GameState: 작업장 레벨·창고, 펫 배치(`pet.workshop` + 슬롯 번호)
3. 규칙 `scripts/systems/production_system.gd` (5초마다 생산, 적성 2배, 창고 한도), 배치·회수·수집·업그레이드
4. 작업장 3D 소품 (벌목장 나무, 광산 바위, 농장 밭) — `workshop_plot.gd` 위에
5. 노동 애니메이션 3종 — `PetVisual`에 도구 + 반복 동작 추가 (도끼질, 곡괭이질, 수확)
6. 작업장 클릭 → 작업장 창(슬롯, 배치/회수, 수집, 업그레이드), 생산 시 "+N" 떠오르는 글자
7. 각 작업마다 `tools/run_tests.sh` + `tools/screenshot.sh`로 확인

## 이어받는 방법
- 저장소: https://github.com/ojuos4545-ship-it/game
- 기존 웹(HTML/JS) 버전 자료는 삭제함. 필요하면 Git 기록에서 복구 가능.
```bash
git pull
```
```bash
tools/run_tests.sh
```
- 통과 87/실패 0 이 나오면 정상 상태.
- Godot 에디터에서 열 때: Godot 4.7.2 → 가져오기 → `project.godot`

## 주의 사항
- 작업장 위치를 바꿀 땐 `world.tscn`의 Plots 위치와 `world.gd`의 `PLOT_SCREEN_POS`를 함께 바꿀 것 (길·장식이 이 값을 기준으로 배치됨).
- 3D 이름표(Label3D)는 창을 열면 어둡게 가려짐 — 정상.
- 클라우드 화면 캡처는 첫 화면 준비가 몇 초 걸려서, 2초짜리 알림을 찍으려면 대기 프레임을 2 정도로 짧게.
- 작업 브랜치는 `claude/little-haven-godot`, 단계 완료 시 `main`에 반영 (사용자 승인).
- 기획 수치는 `GAME_DESIGN.md`에 가안으로 정리됨. 코드에는 쓰지 말고 `data/*.json`에 넣을 것.
