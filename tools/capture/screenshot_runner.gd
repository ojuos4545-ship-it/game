extends Node
## 화면 캡처 도구 (Claude Code가 결과 화면을 확인할 때 사용).
## 사용법: tools/screenshot.sh [저장경로.png] [대기프레임수] [--press=버튼이름 ...]
## 메인 화면을 띄우고 (지정한 버튼을 누른 뒤) 잠시 기다려 PNG로 저장하고 종료한다.

var _out_path := "user://screenshot.png"
var _wait_frames := 60
var _presses: Array[String] = []


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):
			_out_path = arg.trim_prefix("--out=")
		elif arg.begins_with("--frames="):
			_wait_frames = int(arg.trim_prefix("--frames="))
		elif arg.begins_with("--press="):
			_presses.append(arg.trim_prefix("--press="))
	var main_path: String = ProjectSettings.get_setting("application/run/main_scene")
	var main: Node = load(main_path).instantiate()
	add_child(main)
	await get_tree().process_frame
	for button_name in _presses:
		var button: Node = main.find_child(button_name, true, false)
		if button is BaseButton:
			button.pressed.emit()
			print("[Capture] 버튼 누름: ", button_name)
		else:
			push_error("[Capture] 버튼을 찾을 수 없음: " + button_name)
	for i in _wait_frames:
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var err := img.save_png(_out_path)
	print("[Capture] 저장: ", _out_path, " (", error_string(err), ")")
	get_tree().quit(0 if err == OK else 1)
