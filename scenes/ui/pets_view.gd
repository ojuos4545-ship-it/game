extends VBoxContainer
## "내 펫" 창 내용: 보유 펫 목록 + 기본 펫 입양.

var _count_label: Label
var _grid: GridContainer
var _adopt_row: HBoxContainer


func _ready() -> void:
	name = "PetsView"
	add_theme_constant_override("separation", 10)
	_count_label = UIParts.label("", &"", HORIZONTAL_ALIGNMENT_LEFT)
	add_child(_count_label)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	_grid = GridContainer.new()
	_grid.columns = 6
	_grid.add_theme_constant_override("h_separation", 8)
	_grid.add_theme_constant_override("v_separation", 8)
	scroll.add_child(_grid)

	add_child(UIParts.label("입양하기 (기본 펫 한 마리 추가)", &"", HORIZONTAL_ALIGNMENT_LEFT))
	_adopt_row = HBoxContainer.new()
	_adopt_row.add_theme_constant_override("separation", 8)
	add_child(_adopt_row)

	GameState.pets_changed.connect(refresh)
	GameState.resource_changed.connect(func(_id, _n): _refresh_adopt())
	refresh()


func refresh() -> void:
	_count_label.text = "보유 펫 %d마리" % GameState.pets.size()
	UIParts.clear(_grid)
	for pet in GameState.pets:
		_grid.add_child(_make_pet_card(pet))
	_refresh_adopt()


func _make_pet_card(pet: Dictionary) -> Control:
	var info := DataDB.get_pet(pet.species)
	var parts := UIParts.card(Vector2(110, 0))
	var box: VBoxContainer = parts[1]
	box.add_child(UIParts.portrait(pet.species, 80))
	box.add_child(UIParts.label(info.name))
	box.add_child(UIParts.label(DataDB.pet_elements_text(pet.species), &"SmallLabel"))
	var status := "쉬는 중"
	if not pet.workshop.is_empty():
		status = DataDB.get_workshop(pet.workshop).get("name", "") + "에서 일함"
	box.add_child(UIParts.label(status, &"SmallLabel"))
	parts[0].tooltip_text = info.description
	return parts[0]


func _refresh_adopt() -> void:
	if not _adopt_row:
		return
	UIParts.clear(_adopt_row)
	for id in DataDB.pet_ids:
		var info := DataDB.get_pet(id)
		if info.obtain != "base":
			continue
		var b := Button.new()
		b.name = "Adopt_" + id
		b.text = "%s\n%s" % [info.name, DataDB.cost_text(info.adopt_cost)]
		b.icon = PetPortraits.get_texture(id)
		b.expand_icon = true
		b.custom_minimum_size = Vector2(170, 64)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size", 16)
		b.add_theme_constant_override("icon_max_width", 48)
		b.disabled = not AdoptionSystem.check(id).is_empty()
		b.tooltip_text = AdoptionSystem.check(id) if b.disabled else "%s 한 마리를 입양합니다" % info.name
		b.pressed.connect(_on_adopt.bind(id))
		_adopt_row.add_child(b)


func _on_adopt(species: String) -> void:
	var result := AdoptionSystem.adopt(species)
	get_tree().call_group("hud", "show_toast", result.message)
