extends VBoxContainer
## "펫 도감" 창 내용: 전체 펫 칸. 발견하지 못한 펫은 검은 실루엣과 "???".

var _count_label: Label
var _grid: GridContainer


func _ready() -> void:
	name = "DexView"
	add_theme_constant_override("separation", 10)
	_count_label = UIParts.label("", &"", HORIZONTAL_ALIGNMENT_LEFT)
	add_child(_count_label)
	_grid = GridContainer.new()
	_grid.columns = 4
	_grid.add_theme_constant_override("h_separation", 10)
	_grid.add_theme_constant_override("v_separation", 10)
	add_child(_grid)
	GameState.pets_changed.connect(refresh)
	refresh()


func refresh() -> void:
	_count_label.text = "발견한 펫 %d / %d" % [GameState.discovered.size(), DataDB.pet_ids.size()]
	UIParts.clear(_grid)
	for id in DataDB.pet_ids:
		_grid.add_child(_make_entry(id))


func _make_entry(species: String) -> Control:
	var info := DataDB.get_pet(species)
	var found := GameState.is_discovered(species)
	var parts := UIParts.card(Vector2(176, 190))
	parts[0].name = "Dex_" + species
	var box: VBoxContainer = parts[1]
	box.add_child(UIParts.portrait(species, 84, not found))
	box.add_child(UIParts.label(info.name if found else "???"))
	if found:
		box.add_child(UIParts.label(DataDB.pet_elements_text(species), &"SmallLabel"))
		var desc := UIParts.label(info.description, &"SmallLabel")
		desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		desc.add_theme_font_size_override("font_size", 13)
		box.add_child(desc)
	else:
		box.add_child(UIParts.label("조합으로 발견할 수 있어요", &"SmallLabel"))
	return parts[0]
