extends VBoxContainer
## "펫 조합" 창 내용.
## [재료 칸 A] + [재료 칸 B] = [결과 미리보기]  /  비용 + 조합 버튼  /  보유 펫 고르기
## - 아래 펫을 누르면 빈 재료 칸에 들어간다. 재료 칸을 누르면 비워진다.
## - 조합표에 있는 조합이면 결과 칸에 (아직 못 찾은 펫은 실루엣으로) 미리 보여준다.

const SLOT_SIZE := Vector2(150, 170)

## 재료 칸에 고른 펫 종류 ("" = 비어 있음)
var selected: Array[String] = ["", ""]

var _slot_buttons: Array[Button] = []
var _result_box: VBoxContainer
var _info_label: Label
var _combine_button: Button
var _picker: GridContainer
## 마지막 조합 결과 (결과 칸에 잠시 보여주기 위해)
var _last_result := ""


func _ready() -> void:
	name = "CombineView"
	add_theme_constant_override("separation", 10)

	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	add_child(row)
	for i in 2:
		var b := Button.new()
		b.name = "Slot%d" % i
		b.custom_minimum_size = SLOT_SIZE
		b.expand_icon = true
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
		b.add_theme_constant_override("icon_max_width", 110)
		b.pressed.connect(_on_slot_pressed.bind(i))
		_slot_buttons.append(b)
		row.add_child(b)
		if i == 0:
			row.add_child(_symbol("+"))
	row.add_child(_symbol("="))
	var result_card := UIParts.card(SLOT_SIZE)
	result_card[0].name = "ResultCard"
	_result_box = result_card[1]
	_result_box.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_child(result_card[0])

	var action := HBoxContainer.new()
	action.alignment = BoxContainer.ALIGNMENT_CENTER
	action.add_theme_constant_override("separation", 16)
	add_child(action)
	_info_label = UIParts.label("")
	_info_label.custom_minimum_size.x = 380
	action.add_child(_info_label)
	_combine_button = Button.new()
	_combine_button.name = "CombineGoButton"
	_combine_button.text = "조합하기"
	_combine_button.theme_type_variation = &"MenuButtonBig"
	_combine_button.pressed.connect(_on_combine_pressed)
	action.add_child(_combine_button)

	add_child(UIParts.label("보유 펫 (눌러서 재료로 넣기)", &"", HORIZONTAL_ALIGNMENT_LEFT))
	_picker = GridContainer.new()
	_picker.columns = 8
	_picker.add_theme_constant_override("h_separation", 6)
	add_child(_picker)

	GameState.pets_changed.connect(refresh)
	GameState.resource_changed.connect(func(_id, _n): _refresh_preview())
	visibility_changed.connect(func(): _last_result = "")
	refresh()


func refresh() -> void:
	# 보유하지 않게 된 재료는 비운다 (예: 새 게임)
	for i in 2:
		if not selected[i].is_empty() and GameState.count_species(selected[i]) == 0:
			selected[i] = ""
	_refresh_slots()
	_refresh_preview()
	_refresh_picker()


## 보유 펫 목록에서 펫을 골랐을 때 (빈 칸 순서대로 채움, 둘 다 차 있으면 두 번째 칸 교체)
func pick(species: String) -> void:
	_last_result = ""
	if selected[0].is_empty():
		selected[0] = species
	elif selected[1].is_empty():
		selected[1] = species
	else:
		selected[1] = species
	refresh()


# ---------------- 내부 ----------------

func _symbol(text: String) -> Label:
	var l := UIParts.label(text, &"HeaderLabel")
	l.add_theme_font_size_override("font_size", 40)
	return l


func _refresh_slots() -> void:
	for i in 2:
		var b := _slot_buttons[i]
		var sp := selected[i]
		if sp.is_empty():
			b.icon = null
			b.text = "재료 %d" % (i + 1)
		else:
			b.icon = PetPortraits.get_texture(sp)
			b.text = DataDB.get_pet(sp).name


func _refresh_preview() -> void:
	UIParts.clear(_result_box)
	var c := CombineSystem.check(selected[0], selected[1])
	var recipe: Dictionary = c.recipe
	_combine_button.disabled = not c.ok

	if not _last_result.is_empty():
		_result_box.add_child(UIParts.portrait(_last_result, 100))
		_result_box.add_child(UIParts.label(DataDB.get_pet(_last_result).name))
		_result_box.add_child(UIParts.label("획득!", &"SmallLabel"))
	elif not recipe.is_empty():
		var found := GameState.is_discovered(recipe.result)
		_result_box.add_child(UIParts.portrait(recipe.result, 100, not found))
		_result_box.add_child(UIParts.label(DataDB.get_pet(recipe.result).name if found else "???"))
		_result_box.add_child(UIParts.label("도감에 있음" if found else "새로운 펫!", &"SmallLabel"))
	else:
		var q := UIParts.label("?", &"HeaderLabel")
		q.add_theme_font_size_override("font_size", 56)
		_result_box.add_child(q)

	if selected[0].is_empty() or selected[1].is_empty():
		_info_label.text = "아래 보유 펫을 눌러 재료 두 마리를 넣으세요"
	elif recipe.is_empty():
		_info_label.text = c.reason
	else:
		var parts: Array[String] = []
		for id in DataDB.resource_ids:
			if recipe.cost.has(id):
				parts.append("%s %d/%d" % [DataDB.get_resource(id).name, GameState.get_resource(id), recipe.cost[id]])
		_info_label.text = "필요 자원: " + ", ".join(parts)
		if not c.ok:
			_info_label.text += "\n자원이 부족해요"
	_info_label.add_theme_color_override("font_color", Color("4d3320") if c.ok else Color("a5482f"))


func _refresh_picker() -> void:
	UIParts.clear(_picker)
	for id in DataDB.pet_ids:
		var n := GameState.count_species(id)
		if n == 0:
			continue
		var b := Button.new()
		b.name = "Pick_" + id
		b.text = "%s ×%d" % [DataDB.get_pet(id).name, n]
		b.icon = PetPortraits.get_texture(id)
		b.expand_icon = true
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.vertical_icon_alignment = VERTICAL_ALIGNMENT_TOP
		b.custom_minimum_size = Vector2(86, 96)
		b.add_theme_font_size_override("font_size", 14)
		b.add_theme_constant_override("icon_max_width", 52)
		b.pressed.connect(pick.bind(id))
		_picker.add_child(b)


func _on_slot_pressed(i: int) -> void:
	_last_result = ""
	selected[i] = ""
	refresh()


func _on_combine_pressed() -> void:
	var r := CombineSystem.combine(selected[0], selected[1])
	if r.ok:
		_last_result = r.result
	refresh()
	get_tree().call_group("hud", "show_toast", r.message)
