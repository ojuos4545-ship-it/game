extends Node
## 자동 점검(테스트) 실행기.
## 사용법: tools/run_tests.sh  (또는 godot --headless --path . res://tests/test_runner.tscn)
## 모든 점검을 통과하면 종료 코드 0, 하나라도 실패하면 1.

var _passed := 0
var _failed := 0


func _ready() -> void:
	print("========== Little Haven 자동 점검 ==========")
	_test_stage1_project()
	_test_stage2_data()
	_test_stage2_screen()
	print("--------------------------------------------")
	print("결과: 통과 %d / 실패 %d" % [_passed, _failed])
	get_tree().quit(0 if _failed == 0 else 1)


func check(condition: bool, name: String) -> void:
	if condition:
		_passed += 1
		print("  [통과] ", name)
	else:
		_failed += 1
		print("  [실패] ", name)


# ---------- 1단계: 프로젝트 기본 구성 ----------
func _test_stage1_project() -> void:
	print("[1단계] 프로젝트 기본 구성")
	var root := get_tree().root
	check(root.has_node("DataDB"), "DataDB 자동 로드됨")
	check(root.has_node("GameState"), "GameState 자동 로드됨")
	check(root.has_node("SaveManager"), "SaveManager 자동 로드됨")

	var font: Resource = load(ProjectSettings.get_setting("gui/theme/custom_font"))
	check(font is FontFile, "한글 폰트 로드됨")
	if font is FontFile:
		check((font as FontFile).has_char("한".unicode_at(0)), "폰트에 한글 글자 포함")

	var main_path: String = ProjectSettings.get_setting("application/run/main_scene")
	var packed: PackedScene = load(main_path)
	check(packed != null, "메인 화면 파일 로드됨")
	if packed:
		var main := packed.instantiate()
		check(main != null, "메인 화면 생성됨")
		if main:
			main.free()


# ---------- 2단계: 데이터 · 자원 ----------
func _test_stage2_data() -> void:
	print("[2단계] 데이터와 자원")
	check(DataDB.errors.is_empty(), "데이터 파일 오류 없음 %s" % [DataDB.errors])
	check(DataDB.resource_ids == ["wood", "ore", "berry"], "자원 3종 (목재·광석·열매)")
	check(DataDB.workshop_ids == ["lumber", "mine", "farm"], "작업장 3종 (벌목장·광산·농장)")
	check(DataDB.get_workshop("mine").get("name") == "광산", "작업장 이름 읽기")

	GameState.reset()
	check(GameState.get_resource("wood") == 0, "시작 자원 0")
	GameState.add_resource("wood", 5)
	check(GameState.get_resource("wood") == 5, "자원 더하기")
	GameState.add_resource("wood", -10)
	check(GameState.get_resource("wood") == 0, "자원은 0 아래로 내려가지 않음")
	GameState.reset()


# ---------- 2단계: 기본 게임 화면 ----------
func _test_stage2_screen() -> void:
	print("[2단계] 기본 게임 화면")
	var main: Node = load(ProjectSettings.get_setting("application/run/main_scene")).instantiate()
	add_child(main)

	var camera: Camera3D = main.find_child("Camera3D", true, false)
	check(camera != null and camera.projection == Camera3D.PROJECTION_ORTHOGONAL, "쿼터뷰 카메라(직교)")

	var plots: Node = main.find_child("Plots", true, false)
	var names: Array = []
	if plots:
		for plot in plots.get_children():
			var label: Label3D = plot.get_node_or_null("NameLabel")
			names.append(label.text if label else "?")
	check(names == ["벌목장", "광산", "농장"], "작업장 부지 3곳 + 이름표 %s" % [names])

	var hud: Node = main.find_child("HUD", true, false)
	check(hud != null, "화면 UI 존재")
	if hud:
		check(hud.get_amount_text("ore") == "0", "자원바 초기값 0")
		GameState.add_resource("ore", 7)
		check(hud.get_amount_text("ore") == "7", "자원 변경 시 자원바 자동 갱신")

		check(not hud.is_any_window_open(), "시작 시 창 닫혀 있음")
		hud.find_child("PetsButton", true, false).pressed.emit()
		check(hud.windows.pets.visible, "펫 버튼 → 펫 창 열림")
		hud.find_child("CombineButton", true, false).pressed.emit()
		check(hud.windows.combine.visible and not hud.windows.pets.visible, "다른 버튼 → 이전 창 닫히고 새 창 열림")
		hud.find_child("CombineButton", true, false).pressed.emit()
		check(not hud.is_any_window_open(), "같은 버튼 다시 → 창 닫힘")
		hud.find_child("DexButton", true, false).pressed.emit()
		hud.windows.dex.find_child("CloseButton", true, false).pressed.emit()
		check(not hud.is_any_window_open(), "닫기 버튼 → 창 닫힘")

	main.queue_free()
	GameState.reset()
