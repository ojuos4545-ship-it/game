extends VBoxContainer
## "메뉴" 창 내용: 자동 저장 상태, 지금 저장, 새 게임(한 번 더 확인).

var _save_label: Label
var _confirm_row: HBoxContainer
var _new_button: Button


func _ready() -> void:
	name = "MenuView"
	add_theme_constant_override("separation", 14)
	alignment = BoxContainer.ALIGNMENT_CENTER

	add_child(UIParts.label("Little Haven  v%s" % ProjectSettings.get_setting("application/config/version"), &"HeaderLabel"))
	_save_label = UIParts.label("")
	add_child(_save_label)

	var save_now := Button.new()
	save_now.name = "SaveNowButton"
	save_now.text = "지금 저장하기"
	save_now.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	save_now.pressed.connect(_on_save_now)
	add_child(save_now)

	add_child(HSeparator.new())

	_new_button = Button.new()
	_new_button.name = "NewGameButton"
	_new_button.text = "새 게임 시작"
	_new_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_new_button.pressed.connect(func(): _show_confirm(true))
	add_child(_new_button)

	_confirm_row = HBoxContainer.new()
	_confirm_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_confirm_row.add_theme_constant_override("separation", 12)
	add_child(_confirm_row)
	var warn := UIParts.label("정말 처음부터 시작할까요?\n지금까지의 펫·자원·도감이 모두 사라져요.")
	warn.add_theme_color_override("font_color", Color("a5482f"))
	_confirm_row.add_child(warn)
	var yes := Button.new()
	yes.name = "ConfirmNewGameButton"
	yes.text = "처음부터 시작"
	yes.pressed.connect(_on_new_game)
	_confirm_row.add_child(yes)
	var no := Button.new()
	no.name = "CancelNewGameButton"
	no.text = "취소"
	no.pressed.connect(func(): _show_confirm(false))
	_confirm_row.add_child(no)

	SaveManager.saved.connect(_refresh)
	visibility_changed.connect(func():
		_show_confirm(false)
		_refresh())
	_show_confirm(false)
	_refresh()


func _refresh() -> void:
	var when := SaveManager.last_saved_time
	_save_label.text = "자동 저장: 켜짐 (%d초마다, 바뀐 것이 있을 때)\n마지막 저장: %s" % [
		int(SaveManager.AUTOSAVE_INTERVAL), when if not when.is_empty() else "아직 없음"]


func _show_confirm(on: bool) -> void:
	_confirm_row.visible = on
	_new_button.visible = not on


func _on_save_now() -> void:
	var ok := SaveManager.save_game()
	get_tree().call_group("hud", "show_toast", "저장했어요!" if ok else "저장하지 못했어요")


func _on_new_game() -> void:
	SaveManager.start_new_game()
	_show_confirm(false)
	get_tree().call_group("hud", "close_all_windows")
	get_tree().call_group("hud", "show_toast", "새 게임을 시작했어요!")
