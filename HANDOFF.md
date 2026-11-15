# HANDOFF — 다음 작업 인계

**마지막 작업**: 2026-11-15, 클라우드(Claude Code 원격 환경)

## 한 줄 요약
3단계(펫 시스템) 완료. 다음은 **4단계: 조합 시스템**.

## 이번에 한 일
- 데이터: `data/pets.json`(8종), `elements.json`(속성), `balance.json`(시작 펫·자원)
- `GameState`: 보유 펫(`pets`: uid·species·workshop), 도감(`discovered`), 비용 지불(`can_afford`/`spend`), `new_game()`
- 규칙: `scripts/systems/adoption_system.gd` (입양)
- 펫 3D 모형: `scenes/pets/pet_visual.gd` (look 종류별 도형 조합, `play_idle()`)
- 초상화: `PetPortraits` 자동 로드 — 3D 모형을 작은 화면에 찍어 UI 그림으로 사용
- 창 내용: `scenes/ui/pets_view.gd`, `dex_view.gd`, 공통 조각 `ui_parts.gd`, 알림 `HUD.show_toast()`
- 조사 도우미 `scripts/util/korean.gd` (을/를, 이/가, 은/는)
- 캡처 도구 옵션 추가: `--scene=`(다른 화면), `--give=berry:30`(개발용 자원 지급)
- 펫 모형 한눈에 보기: `tools/screenshot.sh build/pets.png 20 --scene=res://tools/capture/pet_gallery.tscn`

## 다음에 할 일 (순서대로)
1. 4단계 시작: `data/recipes.json`(조합표 4개, GAME_DESIGN.md 6장) → DataDB 로딩·검사
2. `scripts/systems/combine_system.gd` (순서 무관, 비용 확인, 부모 유지) — adoption_system.gd 와 같은 형식
3. 조합 창 `scenes/ui/combine_view.gd` → HUD에서 `windows.combine.set_view(...)`
4. 결과 연출 (새 펫 발견 알림은 이미 GameState.pet_discovered → HUD 토스트로 연결됨)
5. 각 작업마다 `tools/run_tests.sh` + `tools/screenshot.sh`로 확인

## 이어받는 방법
- 저장소: https://github.com/ojuos4545-ship-it/game
- 기존 웹(HTML/JS) 버전 자료는 삭제함. 필요하면 Git 기록에서 복구 가능.
```bash
git pull
```
```bash
tools/run_tests.sh
```
- 통과 53/실패 0 이 나오면 정상 상태.
- Godot 에디터에서 열 때: Godot 4.7.2 → 가져오기 → `project.godot`

## 주의 사항
- 작업장 위치를 바꿀 땐 `world.tscn`의 Plots 위치와 `world.gd`의 `PLOT_SCREEN_POS`를 함께 바꿀 것 (길·장식이 이 값을 기준으로 배치됨).
- 3D 이름표(Label3D)는 창을 열면 어둡게 가려짐 — 정상.
- 클라우드 화면 캡처는 첫 화면 준비가 몇 초 걸려서, 2초짜리 알림을 찍으려면 대기 프레임을 2 정도로 짧게.
- `main` 브랜치 반영은 이 클라우드 세션의 권한 설정상 막혀 있음 → 작업은 `claude/little-haven-godot` 브랜치에 있음 (README 참고).
- 기획 수치는 `GAME_DESIGN.md`에 가안으로 정리됨. 코드에는 쓰지 말고 `data/*.json`에 넣을 것.
