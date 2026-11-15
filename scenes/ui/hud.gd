extends Control
## 화면 UI: 상단 자원 표시줄 + 하단 메뉴 버튼 + 메뉴 창(펫·조합·도감) + 알림 메시지.
## 자원 숫자는 GameState 의 신호를 듣고 자동으로 바뀐다.
## 다른 화면에서 알림을 띄울 때: get_tree().call_group("hud", "show_toast", "메시지")

const PetsView := preload("res://scenes/ui/pets_view.gd")
const DexView := preload("res://scenes/ui/dex_view.gd")
const CombineView := preload("res://scenes/ui/combine_view.gd")

## 자원 id -> 수량 표시 Label
var _amount_labels: Dictionary = {}
var _toast_tween: Tween
## 창 이름 -> 창
@onready var windows: Dictionary = {
	"pets": %PetsWindow,
	"combine": %CombineWindow,
	"dex": %DexWindow,
}
@onready var _buttons: Dictionary = {
	"pets": %PetsButton,
	"combine": %CombineButton,
	"dex": %DexButton,
}


func _ready() -> void:
	add_to_group("hud")
	_build_resource_bar()
	windows.pets.set_view(PetsView.new())
	windows.dex.set_view(DexView.new())
	windows.combine.set_view(CombineView.new())
	GameState.pet_discovered.connect(_on_pet_discovered)
	%Toast.visible = false
	GameState.resource_changed.connect(_on_resource_changed)
	for key in windows:
		_buttons[key].pressed.connect(toggle_window.bind(key))
		windows[key].close_requested.connect(close_all_windows)
	%Dim.gui_input.connect(_on_dim_input)
	close_all_windows()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") and is_any_window_open():
		close_all_windows()
		get_viewport().set_input_as_handled()


## 같은 버튼을 다시 누르면 닫히고, 다른 창이 열려 있으면 그 창을 닫고 연다.
func toggle_window(key: String) -> void:
	var was_open: bool = windows[key].visible
	close_all_windows()
	if not was_open:
		windows[key].visible = true
		%Dim.visible = true


func close_all_windows() -> void:
	for w in windows.values():
		w.visible = false
	%Dim.visible = false


func is_any_window_open() -> bool:
	return %Dim.visible


## 화면 위쪽에 잠깐 알림 메시지를 띄운다
func show_toast(text: String) -> void:
	%ToastLabel.text = text
	%Toast.visible = true
	%Toast.modulate.a = 1.0
	if _toast_tween:
		_toast_tween.kill()
	_toast_tween = create_tween()
	_toast_tween.tween_interval(1.8)
	_toast_tween.tween_property(%Toast, "modulate:a", 0.0, 0.4)
	_toast_tween.tween_callback(func(): %Toast.visible = false)


func get_toast_text() -> String:
	return %ToastLabel.text if %Toast.visible else ""


func get_amount_text(resource_id: String) -> String:
	return _amount_labels[resource_id].text if _amount_labels.has(resource_id) else ""


# ---------------- 내부 ----------------

func _build_resource_bar() -> void:
	for id in DataDB.resource_ids:
		var info := DataDB.get_resource(id)
		var chip := HBoxContainer.new()
		chip.add_theme_constant_override("separation", 8)
		chip.custom_minimum_size.x = 150

		var icon := Panel.new()
		icon.custom_minimum_size = Vector2(26, 26)
		icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var style := StyleBoxFlat.new()
		style.bg_color = info.color
		style.set_corner_radius_all(13)
		style.set_border_width_all(2)
		style.border_color = Color(0.3, 0.2, 0.12)
		icon.add_theme_stylebox_override("panel", style)
		chip.add_child(icon)

		var name_label := Label.new()
		name_label.text = info.name
		chip.add_child(name_label)

		var amount := Label.new()
		amount.name = "Amount_" + id
		amount.theme_type_variation = &"HeaderLabel"
		amount.add_theme_font_size_override("font_size", 24)
		amount.text = str(GameState.get_resource(id))
		chip.add_child(amount)

		_amount_labels[id] = amount
		%ResourceBox.add_child(chip)


func _on_resource_changed(id: String, amount: int) -> void:
	if _amount_labels.has(id):
		_amount_labels[id].text = str(amount)


func _on_pet_discovered(species: String) -> void:
	show_toast("새로운 펫 발견! %s (도감에 등록됨)" % DataDB.get_pet(species).name)


func _on_dim_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		close_all_windows()
