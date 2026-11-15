extends Node
## 자동 점검(테스트) 실행기.
## 사용법: tools/run_tests.sh  (또는 godot --headless --path . res://tests/test_runner.tscn)
## 모든 점검을 통과하면 종료 코드 0, 하나라도 실패하면 1.

var _passed := 0
var _failed := 0


func _ready() -> void:
	print("========== Little Haven 자동 점검 ==========")
	_test_stage1_project()
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
